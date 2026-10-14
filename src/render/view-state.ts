/** Everything the renderer needs for one frame, already interpolated. Hosts and clients build this differently. */
export interface TankViewState {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  hullAngle: number;
  aimAngle: number;
  health: number;
  alive: boolean;
  invulnerable: boolean;
}

export interface ProjectileViewState {
  id: number;
  x: number;
  y: number;
  angle: number;
}

export interface ViewState {
  tanks: TankViewState[];
  projectiles: ProjectileViewState[];
  /** Where the camera should look; null keeps it where it is. */
  cameraFocus: { x: number; y: number } | null;
}
