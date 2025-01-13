import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { SubscribeNotificationDto } from './dto/subscribe-notification.dto';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly firebaseApp: admin.app.App;

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.configService.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.configService
            .get('FIREBASE_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
        }),
      });
    } else {
      this.firebaseApp = admin.app();
    }
  }

  async sendNotification(dto: SendNotificationDto) {
    try {
      const promises: Promise<any>[] = [];

      // Handle email notification if provided
      if (dto.email) {
        const emailPromise = this.mailService.sendMail({
          from: dto.email.from,
          to: dto.email.to,
          subject: dto.email.subject,
          text: dto.email.text,
          templatePath: dto.email.templatePath,
          templateData: dto.email.templateData,
        });
        promises.push(emailPromise);
      }

      // Handle push notification if provided
      if (dto.push) {
        // Send notification to all device tokens
        dto.push.deviceTokens.forEach((deviceToken) => {
          const message: admin.messaging.Message = {
            token: deviceToken,
            notification: {
              title: dto.push.title,
              body: dto.push.message,
              imageUrl: dto.push.image,
            },
          };

          const pushPromise = this.firebaseApp
            .messaging()
            .send(message)
            .then((response) => {
              this.logger.debug(
                `Successfully sent push notification: ${response}`,
              );
              return response;
            })
            .catch((error) => {
              this.logger.error('Error sending push notification:', error);
              throw error;
            });

          promises.push(pushPromise);
        });
      }

      // Wait for all notifications to be sent
      const results = await Promise.allSettled(promises);

      // Log results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          this.logger.debug(
            `Notification ${index + 1} sent successfully:`,
            result.value,
          );
        } else {
          this.logger.error(`Notification ${index + 1} failed:`, result.reason);
        }
      });

      return {
        message: 'Notifications processed',
        results: results.map((result) => ({
          status: result.status,
          ...(result.status === 'fulfilled'
            ? { value: result.value }
            : { error: result.reason }),
        })),
      };
    } catch (error) {
      this.logger.error('Error in sendNotification:', error);
      throw error;
    }
  }

  async subscribeDevice(
    userId: number,
    sessionId: string,
    dto: SubscribeNotificationDto,
  ) {
    try {
      // Verify the session belongs to the user
      const session = await this.prisma.userLoginSession.findUnique({
        where: { sessionId },
        select: { userId: true },
      });

      if (!session || session.userId !== userId) {
        throw new UnauthorizedException('Invalid session');
      }

      // Update the session with the device token
      await this.prisma.userLoginSession.update({
        where: { sessionId },
        data: { deviceToken: dto.deviceToken },
      });

      this.logger.debug(`Device token updated for session ${sessionId}`);
      return { message: 'Device subscribed successfully' };
    } catch (error) {
      this.logger.error('Error in subscribeDevice:', error);
      throw error;
    }
  }

  async testPushNotification(deviceToken: string) {
    try {
      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: {
          title: 'Test Notification',
          body: 'This is a test push notification',
        },
      };

      const response = await this.firebaseApp.messaging().send(message);
      this.logger.debug(`Successfully sent test notification: ${response}`);

      return {
        message: 'Test notification sent successfully',
        messageId: response,
      };
    } catch (error) {
      this.logger.error('Error sending test notification:', error);
      throw error;
    }
  }
}
