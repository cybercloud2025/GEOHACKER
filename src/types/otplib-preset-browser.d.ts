declare module '@otplib/preset-browser' {
  export const authenticator: {
    generateSecret: (len?: number) => string;
    keyuri: (user: string, service: string, secret: string) => string;
    generate: (secret: string) => string;
    check: (token: string, secret: string) => boolean;
    verify: (opts: { token: string; secret: string }) => boolean;
    options: Record<string, unknown>;
  };
}
