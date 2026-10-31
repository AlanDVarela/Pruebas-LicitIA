declare module 'html-to-docx' {
  export default function htmlToDocx(html: string, header?: string, options?: Record<string, unknown>, footer?: string): Promise<Buffer | ArrayBuffer | Blob>;
}
