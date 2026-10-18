declare module "pdfmake/build/pdfmake.min" {
  interface PdfDocument {
    getBlob(): Promise<Blob>;
    print(window?: Window): Promise<void>;
  }

  const pdfmake: {
    addVirtualFileSystem(fonts: Record<string, string>): void;
    addFonts(
      fonts: Record<
        string,
        { normal: string; bold: string; italics: string; bolditalics: string }
      >
    ): void;
    setUrlAccessPolicy(policy: (url: string) => boolean): void;
    createPdf(definition: Record<string, unknown>): PdfDocument;
  };

  export default pdfmake;
}
