import React from 'react';
import classNames from 'classnames';
import { action, runInAction } from 'mobx';
import { observer, useLocalObservable } from 'mobx-react-lite';
import { GoMute } from 'react-icons/go';
import { RiCheckLine } from 'react-icons/ri';
import { HiOutlineBan } from 'react-icons/hi';
import { AiFillStar, AiOutlineStar } from 'react-icons/ai';
import { Tooltip, Fade } from '@material-ui/core';

import Button from 'components/Button';
import Avatar from 'components/Avatar';

import { useStore } from 'store';
import getProfile from 'store/selectors/getProfile';
import { isGroupOwner } from 'store/selectors/group';
import useActiveGroup from 'store/selectors/useActiveGroup';
import useActiveGroupFollowingPublishers from 'store/selectors/useActiveGroupFollowingPublishers';
import useActiveGroupMutedPublishers from 'store/selectors/useActiveGroupMutedPublishers';
import useCheckPermission from 'hooks/useCheckPermission';
import useUpdatePermission from 'hooks/useUpdatePermission';

import useDatabase from 'hooks/useDatabase';
import { IDbSummary } from 'hooks/useDatabase/models/summary';
import * as PersonModel from 'hooks/useDatabase/models/person';
import { ContentStatus } from 'hooks/useDatabase/contentStatus';
import { IUser } from 'hooks/useDatabase/models/person';

import useMixinPayment from 'standaloneModals/useMixinPayment';

import sleep from 'utils/sleep';
import { lang } from 'utils/lang';

import BuyadrinkWhite from 'assets/buyadrink_white.svg';

import ProfileEditorModal from './ProfileEditorModal';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';

import './index.scss';

interface IProps {
  publisher: string
}

export default observer((props: IProps) => {
  const activeGroup = useActiveGroup();
  const state = useLocalObservable(() => ({
    loading: false,
    banDialog: {
      type: 'ban' as 'ban' | 'unban',
      open: false,
      reason: '',
    },
    user: {
      profile: getProfile(activeGroup.user_pubkey),
      objectCount: 0,
    } as IUser,
    summary: null as IDbSummary | null,
    showProfileEditorModal: false,
    hasPostPermission: false,
  }));
  const {
    activeGroupStore,
    snackbarStore,
    followingStore,
    mutedListStore,
  } = useStore();
  const database = useDatabase();
  const activeGroupFollowingPublishers = useActiveGroupFollowingPublishers();
  const activeGroupMutedPublishers = useActiveGroupMutedPublishers();
  const checkPermission = useCheckPermission();
  const updatePermission = useUpdatePermission();

  const isMySelf = activeGroup.user_pubkey === props.publisher;
  const isSyncing = isMySelf && !!activeGroup.profileStatus && activeGroup.profileStatus !== ContentStatus.synced;
  const isOwner = isGroupOwner(activeGroup);
  const isFollowing = activeGroupFollowingPublishers.includes(props.publisher);
  const muted = activeGroupMutedPublishers.includes(props.publisher);

  React.useEffect(() => {
    (async () => {
      state.hasPostPermission = await checkPermission({
        groupId: activeGroupStore.id,
        publisher: props.publisher,
        trxType: 'POST',
      });
    })();
  }, [props.publisher]);

  React.useEffect(() => {
    (async () => {
      runInAction(() => {
        state.loading = true;
      });
      const db = database;
      const user = await PersonModel.getUser(db, {
        GroupId: activeGroupStore.id,
        Publisher: props.publisher,
        withObjectCount: true,
      });
      runInAction(() => {
        state.user = user;
        state.loading = false;
      });
    })();
  }, [state, props.publisher, activeGroup.user_pubkey, activeGroupStore.profile]);

  const follow = (publisher: string) => {
    followingStore.follow({
      groupId: activeGroupStore.id,
      publisher,
    });
  };

  const unFollow = (publisher: string) => {
    followingStore.unFollow({
      groupId: activeGroupStore.id,
      publisher,
    });
  };

  const mute = (publisher: string) => {
    mutedListStore.mute({
      groupId: activeGroupStore.id,
      publisher,
    });
  };

  const unmute = (publisher: string) => {
    mutedListStore.unmute({
      groupId: activeGroupStore.id,
      publisher,
    });
  };

  const handlePermissionConfirm = async () => {
    try {
      await updatePermission({
        groupId: activeGroupStore.id,
        publisher: props.publisher,
        trxType: 'POST',
        action: state.hasPostPermission ? 'deny' : 'allow',
      });
      await sleep(200);
      state.hasPostPermission = !state.hasPostPermission;
    } catch (err) {
      console.error(err);
      snackbarStore.show({
        message: lang.somethingWrong,
        type: 'error',
      });
    }
  };

  return (
    <div className="relative overflow-hidden profile rounded-0 bg-white border border-gray-88 mb-3">
      <div className="flex justify-between items-stretch text-black">
        {!isMySelf && (
          <>
            <div className="flex items-end py-[18px] pl-10">
              <Avatar
                className={classNames(
                  state.loading && 'invisible',
                  'bg-white ml-1',
                )}
                loading={isSyncing}
                url={state.user.profile.avatar}
                size={74}
              />
              <div className="ml-5">
                <div
                  className={classNames(
                    state.loading && 'invisible',
                    'font-bold text-18 leading-none text-gray-4a flex items-center',
                  )}
                >
                  {state.user.profile.name}
                  {isOwner && (
                    <div className="ml-2 transform scale-75 text-gray-88" onClick={handlePermissionConfirm}>
                      <FormGroup>
                        <FormControlLabel
                          control={<Switch checked={state.hasPostPermission} color='primary' />}
                          label={lang.writable}
                        />
                      </FormGroup>
                    </div>
                  )}
                </div>
                <div className="mt-10-px text-14 text-gray-4a pb-1 font-normal tracking-wide">
                  {lang.contentCount(state.user.objectCount)}
                </div>
              </div>
            </div>
            <div className="flex items-stretch">
              <div className="flex flex-col justify-center items-center mr-10">
                {state.user?.profile?.mixinUID && (
                  <div className="flex items-center mb-3">
                    <Button
                      size='small'
                      onClick={() => {
                        useMixinPayment({
                          name: state.user.profile.name || '',
                          mixinUID: state.user.profile.mixinUID || '',
                        });
                      }}
                    >
                      <img className="w-[9px] mr-[12px]" src={BuyadrinkWhite} alt="buyadrink_white" />
                      {lang.tip}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-col bg-gray-ec text-14 text-gray-6f cursor-pointer">
                <div
                  className="flex-1 flex items-center justify-center border-b border-white py-[14px] w-28"
                  onClick={() => {
                    if (isFollowing) {
                      unFollow(props.publisher);
                    } else {
                      follow(props.publisher);
                    }
                  }}
                >
                  {isFollowing ? <AiFillStar className="text-20 mr-[6px]" /> : <AiOutlineStar className="text-20 mr-[6px]" />}
                  {isFollowing ? lang.following : lang.follow}
                </div>
                <div
                  className="flex-1 flex items-center justify-center border-t border-white py-[14px] w-28"
                  onClick={() => {
                    if (muted) {
                      unmute(props.publisher);
                    } else {
                      mute(props.publisher);
                    }
                  }}
                >
                  {muted ? <GoMute className="text-20 mr-2" /> : <HiOutlineBan className="text-18 mr-2" />}
                  {muted ? lang.muted : lang.mute}
                </div>
              </div>
            </div>
          </>
        )}

        {isMySelf && (
          <>
            <div className="flex items-end py-[18px] pl-10">
              <Avatar
                className={classNames(
                  {
                    invisible: state.loading,
                  },
                  'bg-white ml-1',
                )}
                loading={isSyncing}
                url={state.user.profile.avatar}
                size={74}
              />
              <div className="ml-5">
                <div
                  className={classNames(
                    {
                      invisible: state.loading,
                    },
                    'font-bold text-18 leading-none text-gray-4a flex items-center',
                  )}
                >
                  {state.user.profile.name}
                </div>
                <div className="mt-10-px text-14 text-gray-9b pb-1 font-bold tracking-wide">
                  {lang.contentCount(state.user.objectCount)}
                </div>
              </div>
            </div>
            <div
              className={classNames(
                isSyncing && 'mt-4',
                'mr-10 flex items-center',
              )}
            >
              <div>
                <Button
                  outline
                  className="opacity-60"
                  onClick={action(() => { state.showProfileEditorModal = true; })}
                >
                  {lang.editProfile}
                </Button>
                <ProfileEditorModal
                  open={state.showProfileEditorModal}
                  onClose={action(() => { state.showProfileEditorModal = false; })}
                />
              </div>
            </div>
          </>
        )}

        {isSyncing && (
          <Fade in={true} timeout={500}>
            <Tooltip
              enterDelay={400}
              enterNextDelay={400}
              placement="top"
              title={lang.syncingContentTip2}
              arrow
              interactive
            >
              <div className="px-2 py-1 bg-gray-88 rounded-bl-5 text-white text-12 absolute top-0 right-0 flex items-center">
                {lang.waitForSyncingDone} <RiCheckLine className="text-12 ml-1" />
              </div>
            </Tooltip>
          </Fade>
        )}
      </div>
    </div>
  );
});
