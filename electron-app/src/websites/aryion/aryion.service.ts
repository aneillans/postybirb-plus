import * as cheerio from 'cheerio';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { Website } from '../website.base';
import { PlaintextParser } from 'src/description-parsing/plaintext/plaintext.parser';
import { AryionDefaultFileOptions } from './aryion.defaults';
import { FileRecord } from 'src/submission/file-submission/interfaces/file-record.interface';
import { ScalingOptions } from '../interfaces/scaling-options.interface';
import FileSize from 'src/utils/filesize.util';
import UserAccountEntity from 'src/account/models/user-account.entity';
import { LoginResponse } from '../interfaces/login-response.interface';
import Http from 'src/http/http.util';
import { Folder } from '../interfaces/folder.interface';
import { UsernameParser } from 'src/description-parsing/miscellaneous/username.parser';
import { AryionFileOptions } from './aryion.interface';
import { FilePostData } from 'src/submission/post/interfaces/file-post-data.interface';
import { PostResponse } from 'src/submission/post/interfaces/post-response.interface';
import { PostData } from 'src/submission/post/interfaces/post-data.interface';
import { Submission } from 'src/submission/interfaces/submission.interface';
import { DefaultOptions } from 'src/submission/submission-part/interfaces/default-options.interface';
import WebsiteValidator from 'src/utils/website-validator.util';
import { FileSubmission } from 'src/submission/file-submission/interfaces/file-submission.interface';
import { SubmissionPart } from 'src/submission/submission-part/interfaces/submission-part.interface';
import { ValidationParts } from 'src/submission/validator/interfaces/validation-parts.interface';
import { FileSubmissionType } from 'src/submission/file-submission/enums/file-submission-type.enum';
import ImageManipulator from 'src/file-manipulation/manipulators/image.manipulator';

@Injectable()
export class Aryion extends Website {
  readonly BASE_URL = 'https://aryion.com';
  readonly defaultDescriptionParser = PlaintextParser.parse;
  readonly fileSubmissionOptions = AryionDefaultFileOptions;
  readonly usernameShortcuts = [
    {
      key: 'ar',
      url: 'https://aryion.com/g4/user/$1',
    },
  ];
  readonly acceptsFiles = [
    'jpg',
    'jpeg',
    'gif',
    'png',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'swf',
    'vsd',
    'txt',
    'rtf',
    'avi',
    'mpg',
    'mpeg',
    'flv',
    'mp4',
  ];

  async checkLoginStatus(data: UserAccountEntity): Promise<LoginResponse> {
    const status: LoginResponse = { loggedIn: false, username: null };
    const res = await Http.get<string>(`${this.BASE_URL}/g4/treeview.php`, data._id);
    if (res.body.includes('user-link')) {
      status.loggedIn = true;
      const $ = cheerio.load(res.body);
      status.username = $('.user-link').text();
      this.getFolders(data._id, $);
    }
    return status;
  }

  private getFolders(profileId: string, $: CheerioStatic) {
    const folders: Folder[] = [];
    $('.treeview')
      .children()
      .each((i, e) => {
        const myTree: Folder[] = [];
        this.searchFolderTree($, e, myTree);
        folders.push(...myTree);
      });

    this.storeAccountInformation(profileId, 'folders', folders);
  }

  private searchFolderTree($: CheerioStatic, el: CheerioElement, parent: Folder[]) {
    const me: Folder = {
      value: undefined,
      label: '',
    };
    $(el)
      .children()
      .each((i, n) => {
        const node = $(n);
        if (n.name === 'span') {
          me.value = node.attr('data-tid');
          me.label = node.text();
          parent.push(me);
        } else if (n.name === 'ul') {
          me.children = [];
          node.children().each((j, c) => this.searchFolderTree($, c, me.children));
        }
      });
  }

  getScalingOptions(file: FileRecord): ScalingOptions {
    return { maxSize: FileSize.MBtoBytes(20) };
  }

  preparseDescription(text: string) {
    return UsernameParser.replaceText(text, 'ar', ':icon$1:');
  }

  async postFileSubmission(data: FilePostData<AryionFileOptions>): Promise<PostResponse> {
    let postFile = data.primary.file;
    if (data.primary.type === FileSubmissionType.TEXT) {
      if (!WebsiteValidator.supportsFileType(data.submission.primary, this.acceptsFiles)) {
        postFile = data.fallback;
      }
    }

    const form: any = {
      action: 'new-item',
      parentid: data.options.folder,
      MAX_FILE_SIZE: '78643200',
      title: data.title,
      file: postFile,
      thumb: data.thumbnail,
      desc: data.description,
      tags: this.formatTags(data.tags)
        .filter(f => !f.match(/^vore$/i))
        .filter(f => !f.match(/^non-vore$/i))
        .join('\n'),
      'reqtag[]': data.options.requiredTag === '1' ? 'Non-Vore' : '',
      view_perm: data.options.viewPermissions,
      comment_perm: data.options.commentPermissions,
      tag_perm: data.options.tagPermissions,
      scrap: data.options.scraps ? 'on' : '',
    };

    const post = await Http.post<string>(
      `${this.BASE_URL}/g4/itemaction.php`,
      data.part.accountId,
      {
        type: 'multipart',
        data: form,
      },
    );

    this.verifyResponse(post, 'Verify Post');
    try {
      const json = JSON.parse(post.body.replace(/(<textarea>|<\/textarea>)/g, ''));
      if (json.id) {
        return this.createPostResponse({ source: `${this.BASE_URL}${json.url}` });
      }
    } catch (err) {}
    return Promise.reject(this.createPostResponse({ additionalInfo: post.body }));
  }

  async postNotificationSubmission(
    data: PostData<Submission, DefaultOptions>,
  ): Promise<PostResponse> {
    throw new NotImplementedException('Method not implemented');
  }

  validateFileSubmission(
    submission: FileSubmission,
    submissionPart: SubmissionPart<AryionFileOptions>,
    defaultPart: SubmissionPart<DefaultOptions>,
  ): ValidationParts {
    const problems: string[] = [];
    const warnings: string[] = [];
    const isAutoscaling: boolean = submissionPart.data.autoScale;

    const title = defaultPart.data.title || submissionPart.data.title;
    if (title && title.length > 50) {
      warnings.push(`Title will be truncated to 50 characters (${title.substring(0, 50)})`);
    }

    if (!submissionPart.data.folder || !submissionPart.data.folder.length) {
      problems.push('No folder selected.');
    } else {
      if (
        !WebsiteValidator.folderIdExists(
          submissionPart.data.folder.pop(),
          this.getAccountInfo(submissionPart.accountId, 'folders'),
        )
      ) {
        problems.push(`Folder (${submissionPart.data.folder}) not found.`);
      }
    }

    if (!submissionPart.data.requiredTag) {
      problems.push('No required tag selected.');
    }

    if (!WebsiteValidator.supportsFileType(submission.primary, this.acceptsFiles)) {
      if (submission.primary.type === FileSubmissionType.TEXT && !submission.fallback) {
        problems.push(
          `Does not support file format: (${submission.primary.name}) ${submission.primary.mimetype}.`,
        );
        problems.push('A fallback file is required.');
      } else if (submission.primary.type === FileSubmissionType.TEXT && submission.fallback) {
        warnings.push('The fallback text will be used.');
      } else {
        problems.push(
          `Does not support file format: (${submission.primary.name}) ${submission.primary.mimetype}.`,
        );
      }
    }

    const { type, size, name } = submission.primary;
    const maxMB: number = 20;
    if (FileSize.MBtoBytes(maxMB) < size) {
      if (
        isAutoscaling &&
        type === FileSubmissionType.IMAGE &&
        ImageManipulator.isMimeType(submission.primary.mimetype)
      ) {
        warnings.push(`${name} will be scaled down to ${maxMB}MB`);
      } else {
        problems.push(`Aryion limits ${submission.primary.mimetype} to ${maxMB}MB`);
      }
    }

    return { problems, warnings };
  }
}
