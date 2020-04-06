import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { Website } from '../website.base';
import { DefaultDiscordOptions } from './discord.interface';
import { DISCORD_DEFAULT_FILE_SUBMISSION_OPTIONS } from './discord.defaults';
import { FileSubmission } from 'src/submission/file-submission/interfaces/file-submission.interface';
import { SubmissionPart } from 'src/submission/submission-part/interfaces/submission-part.interface';
import { Submission } from 'src/submission/interfaces/submission.interface';
import { LoginResponse } from '../interfaces/login-response.interface';
import { DefaultOptions } from 'src/submission/submission-part/interfaces/default-options.interface';
import { ValidationParts } from 'src/submission/validator/interfaces/validation-parts.interface';
import { FileSubmissionType } from 'src/submission/file-submission/enums/file-submission-type.enum';
import { PlaintextParser } from 'src/description-parsing/plaintext/plaintext.parser';
import UserAccountEntity from 'src/account/models/user-account.entity';
import ImageManipulator from 'src/file-manipulation/manipulators/image.manipulator';
import { FileRecord } from 'src/submission/file-submission/interfaces/file-record.interface';
import { ScalingOptions } from '../interfaces/scaling-options.interface';
import FileSize from 'src/utils/filesize.util';
import FormContent from 'src/utils/form-content.util';
import { PostResponse } from 'src/submission/post/interfaces/post-response.interface';
import { FilePostData } from 'src/submission/post/interfaces/file-post-data.interface';
import { PostData } from 'src/submission/post/interfaces/post-data.interface';

interface DiscordLoginData {
  name: string;
  webhook: string;
}

@Injectable()
export class Discord extends Website {
  private readonly logger = new Logger(Discord.name);

  readonly BASE_URL: string = '';
  readonly acceptsFiles: string[] = []; // accepts all
  readonly acceptsAdditionalFiles: boolean = true;

  readonly defaultStatusOptions: any = {};
  readonly defaultFileSubmissionOptions: DefaultDiscordOptions = DISCORD_DEFAULT_FILE_SUBMISSION_OPTIONS;
  readonly defaultDescriptionParser = PlaintextParser.parse;

  readonly usernameShortcuts = [];

  async checkLoginStatus(data: UserAccountEntity): Promise<LoginResponse> {
    const status: LoginResponse = { loggedIn: false, username: null };

    if (data.data) {
      const webhookData: DiscordLoginData = data.data;
      status.loggedIn = !!webhookData.webhook;
      status.username = webhookData.name;
    }

    return status;
  }

  getScalingOptions(file: FileRecord): ScalingOptions {
    return { maxSize: FileSize.MBtoBytes(8) };
  }

  postNotificationSubmission(data: PostData<Submission>, accountData: DiscordLoginData): Promise<PostResponse> {
    throw new NotImplementedException('Method not implemented.');
  }

  postFileSubmission(data: FilePostData, accountData: DiscordLoginData): Promise<PostResponse> {
    throw new NotImplementedException('Method not implemented.');
  }

  preparseDescription(text: string): string {
    return text
      .replace(/(<b>|<strong>)/gm, '**')
      .replace(/(<\/b>|<\/strong>)/gm, '**')
      .replace(/(<i>|<em>)/gm, '*')
      .replace(/(<\/i>|<\/em>)/gm, '*');
  }

  parseDescription(text: string): string {
    const links =
      text.match(
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gm,
      ) || [];
    const seenLinks = [];
    links.forEach(link => {
      if (seenLinks.includes(link)) {
        return;
      }
      seenLinks.push(link);
      text = text.replace(new RegExp(link, 'gi'), `<${link}>`);
    });
    return text;
  }

  validateFileSubmission(
    submission: FileSubmission,
    submissionPart: SubmissionPart<DefaultDiscordOptions>,
    defaultPart: SubmissionPart<DefaultOptions>,
  ): ValidationParts {
    const problems: string[] = [];
    const warnings: string[] = [];
    const isAutoscaling: boolean = submissionPart.data.autoScale;

    const files = [
      submission.primary,
      ...(submission.additional || []).filter(
        f => !f.ignoredAccounts!.includes(submissionPart.accountId),
      ),
    ];

    files.forEach(file => {
      const { type, size, name, mimetype } = file;
      const maxMB: number = 8;
      if (FileSize.MBtoBytes(maxMB) < size) {
        if (
          isAutoscaling &&
          type === FileSubmissionType.IMAGE &&
          ImageManipulator.isMimeType(mimetype)
        ) {
          warnings.push(`${name} will be scaled down to ${maxMB}MB`);
        } else {
          problems.push(`Discord limits ${mimetype} to ${maxMB}MB`);
        }
      }
    });

    const description = this.defaultDescriptionParser(
      FormContent.getDescription(
        defaultPart.data.description,
        submissionPart.data.description,
      ),
    );

    if (description.length > 2000) {
      warnings.push('Max description length allowed is 2,000 characters.');
    }

    return { problems, warnings };
  }

  validateNotificationSubmission(
    submission: Submission,
    submissionPart: SubmissionPart<any>,
  ): ValidationParts {
    return { problems: [], warnings: [] };
  }
}
