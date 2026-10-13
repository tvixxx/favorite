declare module 'libheif-js' {
  interface DecodedImage {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    display(
      target: { width: number; height: number; data: Uint8ClampedArray },
      callback: (result: { data: Uint8ClampedArray } | null) => void,
    ): void;
    free(): void;
  }
  const libheif: {
    HeifDecoder: new () => { decode(input: Uint8Array): DecodedImage[] };
  };
  export default libheif;
}
