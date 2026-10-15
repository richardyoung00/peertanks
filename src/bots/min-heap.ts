/** A priority queue that always hands back the item with the lowest priority first. */
export class MinHeap<T> {
  private readonly items: { item: T; priority: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: T, priority: number): void {
    this.items.push({ item, priority });
    this.siftUp(this.items.length - 1);
  }

  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top?.item;
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].priority <= this.items[index].priority) return;
      this.swap(index, parent);
      index = parent;
    }
  }

  private siftDown(index: number): void {
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
      if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
      if (smallest === index) return;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }
}
