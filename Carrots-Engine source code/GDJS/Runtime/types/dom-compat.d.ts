declare global {
  interface FontFaceDescriptors {
    variant?: string;
  }

  interface FontFaceSet {
    add(font: FontFace): this;
  }
}

export {};
