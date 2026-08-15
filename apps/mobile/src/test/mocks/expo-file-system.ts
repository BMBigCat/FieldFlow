export class File {
  constructor(private uri: string) {}

  async base64(): Promise<string> {
    return `base64-of-${this.uri}`;
  }
}
