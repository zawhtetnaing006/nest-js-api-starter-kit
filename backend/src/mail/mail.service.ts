import { Injectable, Logger } from '@nestjs/common';
import { Transporter } from './mail.transporter';
import { MailDto } from './mail.dto';
import * as ejs from 'ejs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(
    private readonly transporter: Transporter,
    private readonly configService: ConfigService,
  ) {}

  async sendMail(mailDto: MailDto) {
    const transport = this.transporter.getTransporter();
    let htmlContent = mailDto.text;

    if (mailDto.templatePath && mailDto.templateData) {
      htmlContent = await this.renderTemplate(
        mailDto.templatePath,
        mailDto.templateData,
      );
    }
    try {
      await transport.sendMail({
        from: this.configService.get('MAIL_FROM_ADDRESS'),
        to: mailDto.to,
        subject: mailDto.subject,
        text: mailDto.text,
        html: htmlContent,
      });
    } catch (error) {
      this.logger.error(`Error sending email to ${mailDto.to}`, error.stack);
    }
  }

  async renderTemplate(
    templatePath: string,
    templateData: Record<string, any>,
  ) {
    try {
      return ejs.renderFile(templatePath, templateData);
    } catch (error) {
      this.logger.error(
        `Error rendering template file: ${templatePath}`,
        error.stack,
      );
    }
  }
}
