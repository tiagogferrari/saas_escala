declare module "nodemailer" {
  type TransportOptions = {
    host: string;
    port: number;
    secure: boolean;
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    auth?: {
      user: string;
      pass: string;
    };
  };

  type MailOptions = {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  };

  type Transport = {
    sendMail(options: MailOptions): Promise<unknown>;
  };

  const nodemailer: {
    createTransport(options: TransportOptions): Transport;
  };

  export default nodemailer;
}
