import Database, { IDbExtra } from 'hooks/useDatabase/database';
import { ContentStatus } from 'hooks/useDatabase/contentStatus';
import * as PersonModel from 'hooks/useDatabase/models/person';
import * as ObjectModel from 'hooks/useDatabase/models/object';
import * as SummaryModel from 'hooks/useDatabase/models/summary';
import { IContentItemBasic } from 'apis/content';
import { keyBy } from 'lodash';

export interface ICommentItem extends IContentItemBasic {
  Content: IComment
  commentCount?: number
}

export interface IComment {
  content: string
  objectTrxId: string
  replyTrxId?: string
  threadTrxId?: string
}


export interface IDbCommentItem extends ICommentItem, IDbExtra {}

export interface IDbDerivedCommentItem extends IDbCommentItem {
  Extra: {
    user: PersonModel.IUser
    upVoteCount: number
    voted: boolean
    replyComment?: IDbDerivedCommentItem
    comments?: IDbDerivedCommentItem[]
    object?: ObjectModel.IDbDerivedObjectItem
  }
}

export const bulkAdd = async (db: Database, comments: IDbCommentItem[]) => {
  await db.comments.bulkAdd(comments);
};

export const create = async (db: Database, comment: IDbCommentItem) => {
  comment.commentCount = 0;
  await db.comments.add(comment);
  (async () => {
    try {
      await syncSummary(db, comment);
      if (comment?.Content?.threadTrxId) {
        await db.comments.where({
          TrxId: comment?.Content?.threadTrxId,
        }).modify((comment) => {
          comment.commentCount = comment.commentCount ? comment.commentCount + 1 : 1;
        });
      }
    } catch (err) {
      console.log(err);
    }
  })();
};

export const bulkGet = async (db: Database, TrxIds: string[]) => {
  const comments = await db.comments.where('TrxId').anyOf(TrxIds).toArray();
  const map = keyBy(comments, (comment) => comment.TrxId);
  return TrxIds.map((TrxId) => map[TrxId] || null);
};

export const get = async (
  db: Database,
  options: {
    TrxId: string
    withExtra?: boolean
    withObject?: boolean
  },
) => {
  const comment = await db.comments.get({
    TrxId: options.TrxId,
  });
  if (!comment) {
    return null;
  }
  if (!options.withExtra) {
    return comment as IDbDerivedCommentItem;
  }
  const [result] = await packComments(db, [comment], {
    withObject: options.withObject,
  });
  return result;
};

const syncSummary = async (db: Database, comment: IDbCommentItem) => {
  const count = await db.comments
    .where({
      'Content.objectTrxId': comment.Content.objectTrxId,
    })
    .count();
  await SummaryModel.createOrUpdate(db, {
    GroupId: comment.GroupId,
    ObjectId: comment.Content.objectTrxId,
    ObjectType: SummaryModel.SummaryObjectType.objectComment,
    Count: count,
  });
};

export const markedAsSynced = async (
  db: Database,
  TrxIds: string[],
) => {
  await db.comments.where('TrxId').anyOf(TrxIds).modify({
    Status: ContentStatus.synced,
  });
};

export const list = async (
  db: Database,
  options: {
    GroupId: string
    objectTrxId: string
    limit: number
    offset?: number
    order?: string
  },
) => {
  const result = await db.transaction(
    'r',
    [db.comments, db.persons, db.summary, db.objects],
    async () => {
      let comments;
      if (options && options.order === 'freshly') {
        comments = await db.comments
          .where({
            GroupId: options.GroupId,
            'Content.objectTrxId': options.objectTrxId,
          })
          .reverse()
          .offset(options.offset || 0)
          .limit(options.limit)
          .sortBy('TimeStamp');
      } else if (options && options.order === 'punched') {
        comments = await db.comments
          .where({
            GroupId: options.GroupId,
            'Content.objectTrxId': options.objectTrxId,
          })
          .reverse()
          .offset(options.offset || 0)
          .limit(options.limit)
          .sortBy('commentCount');
      } else {
        comments = await db.comments
          .where({
            GroupId: options.GroupId,
            'Content.objectTrxId': options.objectTrxId,
          })
          .offset(options.offset || 0)
          .limit(options.limit)
          .sortBy('TimeStamp');
      }

      if (comments.length === 0) {
        return [];
      }

      const result = await packComments(db, comments, {
        withSubComments: true,
        order: options && options.order,
      });

      return result;
    },
  );
  return result;
};

const packComments = async (
  db: Database,
  comments: IDbCommentItem[],
  options: {
    withSubComments?: boolean
    withObject?: boolean
    order?: string
  } = {},
) => {
  const [users, objects] = await Promise.all([
    PersonModel.getUsers(db, comments.map((comment) => ({
      GroupId: comment.GroupId,
      Publisher: comment.Publisher,
    }))),
    options.withObject
      ? ObjectModel.bulkGet(db, comments.map((comment) => comment.Content.objectTrxId), {
        withExtra: true,
      })
      : Promise.resolve([]),
  ]);

  const result = await Promise.all(comments.map(async (comment, index) => {
    const user = users[index];
    const object = objects[index];
    const derivedDbComment = {
      ...comment,
      Extra: {
        user,
        upVoteCount: 0,
        voted: false,
      },
    } as IDbDerivedCommentItem;

    if (options.withObject) {
      derivedDbComment.Extra.object = object!;
    }

    const { replyTrxId, threadTrxId } = comment.Content;
    if (replyTrxId && threadTrxId && replyTrxId !== threadTrxId) {
      const replyComment = await db.comments.get({
        TrxId: replyTrxId,
      });
      if (replyComment) {
        const [dbReplyComment] = await packComments(
          db,
          [replyComment],
          options,
        );
        derivedDbComment.Extra.replyComment = dbReplyComment;
      }
    }

    if (options.withSubComments) {
      const { objectTrxId } = comment.Content;
      let subComments;
      if (options && options.order === 'freshly') {
        subComments = await db.comments
          .where({
            'Content.threadTrxId': objectTrxId,
            'Content.objectTrxId': comment.TrxId,
          })
          .reverse()
          .sortBy('TimeStamp');
      } else {
        subComments = await db.comments
          .where({
            'Content.threadTrxId': objectTrxId,
            'Content.objectTrxId': comment.TrxId,
          })
          .sortBy('TimeStamp');
      }
      if (subComments.length) {
        derivedDbComment.Extra.comments = await packComments(
          db,
          subComments,
          {
            ...options,
            withSubComments: false,
          },
        );
      }
    }

    return derivedDbComment;
  }));

  return result;
};
