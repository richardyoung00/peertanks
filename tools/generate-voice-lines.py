# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro-onnx>=0.4", "soundfile"]
# ///
"""
Records the announcer's lines from tools/voice-lines.json with Kokoro, a free local text-to-speech model
(Apache-2.0). Only new or changed lines are recorded again. Run with `npm run voice`.

Writes mp3s and an index.json (which the game reads) to public/audio/voice.
"""

import hashlib
import json
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import soundfile
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
LINES_FILE = ROOT / "tools" / "voice-lines.json"
MODELS_FOLDER = ROOT / "tools" / ".voice-models"
OUTPUT_FOLDER = ROOT / "public" / "audio" / "voice"
INDEX_FILE = OUTPUT_FOLDER / "index.json"

MODEL_RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
MODEL_FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
KOKORO_SAMPLE_RATE = 24000


def finishing_filter(sample_rate: int, pitch: float) -> str:
    """
    The announcer sound: trims the silence around the line, lowers the voice by `pitch` (0.82 is about three
    semitones) without changing its speed, adds punch and a short stadium echo, and levels every line the same.
    """
    return ",".join(
        [
            "silenceremove=start_periods=1:start_threshold=-55dB",
            "areverse",
            "silenceremove=start_periods=1:start_threshold=-55dB",
            "areverse",
            "apad=pad_dur=0.1",
            f"asetrate={sample_rate}*{pitch}",
            f"aresample={sample_rate}",
            f"atempo={1 / pitch:.4f}",
            "highpass=f=70",
            "acompressor=threshold=-20dB:ratio=4:attack=3:release=60:makeup=2",
            "aecho=0.8:0.6:70|140:0.3|0.15",
            "loudnorm=I=-15:TP=-1.5:LRA=7",
        ]
    )


def main() -> None:
    script = json.loads(LINES_FILE.read_text())
    previous = load_previous_index()
    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

    kokoro = None
    files_by_line: dict[str, list[str]] = {}
    recorded: dict[str, str] = {}

    for line_id, variants in script["lines"].items():
        files_by_line[line_id] = []
        for number, text in enumerate(variants, start=1):
            file_name = f"{kebab_case(line_id)}-{number}.mp3"
            fingerprint = take_fingerprint(script, text)
            files_by_line[line_id].append(file_name)
            recorded[file_name] = fingerprint
            if previous.get(file_name) == fingerprint and (OUTPUT_FOLDER / file_name).exists():
                continue
            kokoro = kokoro or load_model()
            print(f"Recording {file_name}: {text}")
            record(kokoro, text, script, OUTPUT_FOLDER / file_name)

    remove_unused_recordings(set(recorded))
    INDEX_FILE.write_text(json.dumps({"lines": files_by_line, "recorded": recorded}, indent=2) + "\n")
    print("Voice lines are up to date.")


def load_previous_index() -> dict[str, str]:
    if not INDEX_FILE.exists():
        return {}
    return json.loads(INDEX_FILE.read_text()).get("recorded", {})


def load_model() -> Kokoro:
    MODELS_FOLDER.mkdir(exist_ok=True)
    for name in MODEL_FILES:
        target = MODELS_FOLDER / name
        if not target.exists():
            print(f"Downloading {name} (once only)…")
            urllib.request.urlretrieve(f"{MODEL_RELEASE}/{name}", target)
    return Kokoro(str(MODELS_FOLDER / MODEL_FILES[0]), str(MODELS_FOLDER / MODEL_FILES[1]))


def record(kokoro: Kokoro, text: str, script: dict, target: Path) -> None:
    samples, sample_rate = kokoro.create(text, voice=script["voice"], speed=script["speed"], lang="en-us")
    with tempfile.NamedTemporaryFile(suffix=".wav") as raw:
        soundfile.write(raw.name, samples, sample_rate)
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", raw.name, "-af",
             finishing_filter(sample_rate, script["pitch"]),
             "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "96k", str(target)],
            check=True,
        )


def remove_unused_recordings(keep: set[str]) -> None:
    for file in OUTPUT_FOLDER.glob("*.mp3"):
        if file.name not in keep:
            file.unlink()


def take_fingerprint(script: dict, text: str) -> str:
    """Changes whenever anything that affects the recording does, including the finishing filter."""
    settings = f"{script['voice']}|{script['speed']}|{finishing_filter(KOKORO_SAMPLE_RATE, script['pitch'])}"
    return hashlib.sha256(f"{settings}|{text}".encode()).hexdigest()[:16]


def kebab_case(name: str) -> str:
    return "".join(f"-{char.lower()}" if char.isupper() else char for char in name)


if __name__ == "__main__":
    main()
