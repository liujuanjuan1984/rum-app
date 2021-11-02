import React from 'react';
import { observer, useLocalObservable } from 'mobx-react-lite';
import Dialog from 'components/Dialog';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Avatar from 'components/Avatar';
import { useStore } from 'store';
import Badge from '@material-ui/core/Badge';
import useDatabase from 'hooks/useDatabase';
import Loading from 'components/Loading';
import BottomLine from 'components/BottomLine';
import { sleep, ago } from 'utils';
import classNames from 'classnames';
import * as NotificationModel from 'hooks/useDatabase/models/notification';
import * as CommentModel from 'hooks/useDatabase/models/comment';
import * as ObjectModel from 'hooks/useDatabase/models/object';
import useInfiniteScroll from 'react-infinite-scroll-hook';
import { GoChevronRight } from 'react-icons/go';
import useActiveGroupLatestStatus from 'store/selectors/useActiveGroupLatestStatus';

interface IProps {
  open: boolean;
  onClose: () => void;
}

interface ITab {
  unreadCount: number;
  text: string;
}

const TabLabel = (tab: ITab) => {
  return (
    <div className="relative">
      <div className="absolute top-0 right-0 -mt-2 -mr-2">
        <Badge
          badgeContent={tab.unreadCount}
          className="transform scale-75 cursor-pointer"
          color="error"
        />
      </div>
      {tab.text}
    </div>
  );
};

const LIMIT = 10;

const Notification = observer(() => {
  const database = useDatabase();
  const { notificationStore, activeGroupStore, groupStore } = useStore();
  const { notifications } = notificationStore;
  const { notificationUnreadCountMap: unreadCountMap } =
    useActiveGroupLatestStatus();
  const state = useLocalObservable(() => ({
    tab: 0,
    loading: false,
    page: 1,
    loadingMore: false,
    hasMore: true,
  }));
  const tabs = [
    {
      unreadCount:
        unreadCountMap.notificationUnreadCommentLike +
        unreadCountMap.notificationUnreadObjectLike,
      text: '点赞',
    },
    {
      unreadCount: unreadCountMap.notificationUnreadCommentObject,
      text: '评论',
    },
    {
      unreadCount: unreadCountMap.notificationUnreadCommentReply,
      text: '回复',
    },
  ] as ITab[];

  React.useEffect(() => {
    if (state.loading) {
      return;
    }
    state.loading = true;
    (async () => {
      try {
        let types = [] as NotificationModel.NotificationType[];
        if (state.tab === 0) {
          types = [
            NotificationModel.NotificationType.commentLike,
            NotificationModel.NotificationType.objectLike,
          ];
        } else if (state.tab === 1) {
          types = [NotificationModel.NotificationType.commentObject];
        } else {
          types = [NotificationModel.NotificationType.commentReply];
        }
        const notifications = await NotificationModel.list(database, {
          GroupId: activeGroupStore.id,
          Types: types,
          offset: (state.page - 1) * LIMIT,
          limit: LIMIT,
        });
        await sleep(300);
        notificationStore.addNotifications(notifications);
        const unreadNotifications = notifications.filter(
          (notification) =>
            notification.Status === NotificationModel.NotificationStatus.unread
        );
        if (unreadNotifications.length > 0) {
          for (const notification of unreadNotifications) {
            await NotificationModel.markAsRead(database, notification.Id || '');
          }
          const unreadCountMap = await NotificationModel.getUnreadCountMap(
            database,
            {
              GroupId: activeGroupStore.id,
            }
          );
          groupStore.updateLatestStatusMap(activeGroupStore.id, {
            notificationUnreadCountMap: unreadCountMap,
          });
        }
        if (notifications.length < LIMIT) {
          state.hasMore = false;
        }
      } catch (err) {
        console.error(err);
      }
      state.loading = false;
    })();
  }, [state.tab, state.page]);

  React.useEffect(() => {
    return () => {
      notificationStore.clear();
    };
  }, []);

  const infiniteRef: any = useInfiniteScroll({
    loading: state.loading,
    hasNextPage: state.hasMore,
    scrollContainer: 'parent',
    threshold: 200,
    onLoadMore: async () => {
      if (state.loading) {
        return;
      }
      state.page = state.page + 1;
    },
  });

  return (
    <div className="bg-white rounded-12 pt-2 pb-5">
      <div className="w-[550px]" ref={infiniteRef}>
        <Tabs
          className="px-8"
          value={state.tab}
          onChange={(_e, newTab) => {
            if (state.loading) {
              return;
            }
            state.hasMore = true;
            state.tab = newTab;
            state.page = 1;
            notificationStore.clear();
          }}
        >
          {tabs.map((_tab, idx: number) => {
            return <Tab key={idx} label={TabLabel(_tab)} />;
          })}
        </Tabs>
        <div className="h-[75vh] overflow-y-auto px-8 -mt-2">
          {notifications.length === 0 && state.loading && (
            <div className="pt-32">
              <Loading />
            </div>
          )}
          {(!state.loading || notifications.length > 0) && (
            <div className="py-4" ref={infiniteRef}>
              {state.tab === 0 && <LikeMessages />}
              {state.tab === 1 && <CommentMessages />}
              {state.tab === 2 && <CommentMessages />}
              {notifications.length === 0 && (
                <div className="py-28 text-center text-14 text-gray-400 opacity-80">
                  还没有收到消息 ~
                </div>
              )}
            </div>
          )}
          {notifications.length > 5 && !state.hasMore && <BottomLine />}
        </div>
      </div>
    </div>
  );
});

const CommentMessages = observer(() => {
  const { notificationStore, modalStore } = useStore();
  const { notifications } = notificationStore;

  return (
    <div>
      {notifications.map((notification, index: number) => {
        const comment =
          notification.object as CommentModel.IDbDerivedCommentItem | null;

        if (!comment) {
          return 'comment 不存在';
        }

        const showLastReadFlag =
          index < notifications.length - 1 &&
          notifications[index + 1].Status ===
            NotificationModel.NotificationStatus.read &&
          notification.Status === NotificationModel.NotificationStatus.unread;
        return (
          <div key={notification.Id}>
            <div
              className={classNames(
                {
                  'pb-2': showLastReadFlag,
                  'pb-5': !showLastReadFlag,
                },
                'p-2 pt-5 border-b border-gray-ec'
              )}
            >
              <div className="relative">
                <Avatar
                  className="absolute top-[-5px] left-0"
                  profile={comment.Extra.user.profile}
                  size={40}
                />
                <div className="pl-10 ml-3 text-13">
                  <div className="flex items-center leading-none">
                    <div className="text-gray-4a font-bold">
                      {comment.Extra.user.profile.name}
                    </div>
                    <div className="ml-2 text-gray-9b text-12">
                      {comment.Content.replyTrxId
                        ? '回复了你的评论'
                        : '评论了你的内容'}
                    </div>
                  </div>
                  <div className="mt-2 opacity-90">
                    {comment.Content.content}
                  </div>
                  <div className="pt-3 mt-[2px] text-12 flex items-center text-gray-9b leading-none">
                    <div className="mr-6">{ago(notification.TimeStamp)}</div>
                    <div
                      className="mr-3 hover:text-black hover:font-bold flex items-center cursor-pointer"
                      onClick={() => {
                        modalStore.objectDetail.show({
                          objectTrxId: comment.Content.objectTrxId,
                          selectedCommentOptions: {
                            comment: comment,
                            scrollBlock: 'center',
                          },
                        });
                      }}
                    >
                      打开{comment.Content.replyTrxId ? '回复' : '评论'}
                      <GoChevronRight className="text-14 opacity-80 ml-[-1px]" />
                    </div>
                  </div>
                </div>
              </div>
              {showLastReadFlag && (
                <div className="w-full text-12 text-center pt-10 text-gray-400 ">
                  上次看到这里
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

const LikeMessages = () => {
  const { notificationStore, modalStore } = useStore();
  const { notifications } = notificationStore;

  return (
    <div>
      {notifications.map((notification, index: number) => {
        const object = notification.object as
          | CommentModel.IDbDerivedCommentItem
          | ObjectModel.IDbDerivedObjectItem;

        if (!object) {
          return 'object 不存在';
        }
        const isObject =
          notification.Type === NotificationModel.NotificationType.objectLike;
        const showLastReadFlag =
          index < notifications.length - 1 &&
          notifications[index + 1].Status ===
            NotificationModel.NotificationStatus.read &&
          notification.Status === NotificationModel.NotificationStatus.unread;
        return (
          <div key={notification.Id}>
            <div
              className={classNames(
                {
                  'pb-2': showLastReadFlag,
                  'pb-6': !showLastReadFlag,
                },
                'p-2 pt-6 border-b border-gray-ec'
              )}
            >
              <div className="relative">
                <Avatar
                  className="absolute top-[-5px] left-0"
                  profile={object.Extra.user.profile}
                  size={40}
                />
                <div className="pl-10 ml-3 text-13">
                  <div className="flex items-center leading-none">
                    <div className="text-gray-4a font-bold">
                      {object.Extra.user.profile.name}
                    </div>
                    <div className="ml-2 text-gray-9b text-12">
                      赞了你的{isObject ? '内容' : '评论'}
                    </div>
                  </div>
                  <div className="mt-3 border-l-2 border-gray-300 pl-[9px] text-12 text-gray-70">
                    {object.Content.content}
                  </div>
                  <div className="pt-3 mt-[2px] text-12 flex items-center text-gray-9b leading-none">
                    <div className="mr-6 opacity-90">
                      {ago(notification.TimeStamp)}
                    </div>
                    <div
                      className="mr-3 cursor-pointer hover:text-black hover:font-bold flex items-center"
                      onClick={() => {
                        if (isObject) {
                          modalStore.objectDetail.show({
                            objectTrxId: object.TrxId,
                          });
                        } else {
                          modalStore.objectDetail.show({
                            objectTrxId: (
                              object as CommentModel.IDbDerivedCommentItem
                            ).Content.objectTrxId,
                            selectedCommentOptions: {
                              comment:
                                object as CommentModel.IDbDerivedCommentItem,
                              scrollBlock: 'center',
                            },
                          });
                        }
                      }}
                    >
                      打开{isObject ? '内容' : '评论'}
                      <GoChevronRight className="text-14 opacity-80 ml-[-1px]" />
                    </div>
                  </div>
                </div>
              </div>
              {showLastReadFlag && (
                <div className="w-full text-12 text-center pt-10 text-gray-400">
                  上次看到这里
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default observer((props: IProps) => {
  return (
    <Dialog
      disableBackdropClick={false}
      open={props.open}
      onClose={() => props.onClose()}
      transitionDuration={{
        enter: 300,
      }}
    >
      <Notification />
    </Dialog>
  );
});
