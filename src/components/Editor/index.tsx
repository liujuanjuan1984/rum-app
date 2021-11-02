import React from 'react';
import { observer, useLocalObservable } from 'mobx-react-lite';
import Button from 'components/Button';
import { useStore } from 'store';
import TextareaAutosize from 'react-textarea-autosize';
import classNames from 'classnames';
import Loading from 'components/Loading';
import Tooltip from '@material-ui/core/Tooltip';
import { debounce } from 'lodash';
import { IProfile } from 'store/group';
import Avatar from 'components/Avatar';

interface IProps {
  value: string;
  placeholder: string;
  submit: (content: string) => void;
  saveDraft?: (content: string) => void;
  profile?: IProfile;
  minRows?: number;
  buttonClassName?: string;
  smallSize?: boolean;
  autoFocus?: boolean;
  hideButtonDefault?: boolean;
}

export default observer((props: IProps) => {
  const { snackbarStore } = useStore();
  const state = useLocalObservable(() => ({
    content: props.value || '',
    loading: false,
    activeKeyA: false,
    activeKeyB: false,
    clickedEditor: false,
  }));

  const saveDraft = React.useCallback(
    debounce((content: string) => {
      props.saveDraft && props.saveDraft(content);
    }, 500),
    []
  );

  const submit = async () => {
    if (!state.content.trim() || state.loading) {
      return;
    }
    if (state.content.length > 5000) {
      snackbarStore.show({
        message: '内容不能多余 5000 字',
        type: 'error',
        duration: 2500,
      });
      return;
    }
    state.loading = true;
    try {
      await props.submit(state.content);
      state.content = '';
    } catch (err) {
      state.loading = false;
      console.error(err);
      snackbarStore.show({
        message: '貌似出错了',
        type: 'error',
      });
    }
    state.loading = false;
  };

  return (
    <div className="w-full">
      <div className="flex items-start">
        {props.profile && (
          <Avatar className="block mr-3" profile={props.profile} size={36} />
        )}
        <div className="w-full">
          <div
            className="relative"
            onClick={() => {
              state.clickedEditor = true;
            }}
          >
            <TextareaAutosize
              className={classNames(
                {
                  sm: props.smallSize,
                },
                'w-full textarea-autosize'
              )}
              placeholder={props.placeholder}
              minRows={props.minRows || 2}
              value={state.content}
              autoFocus={props.autoFocus || false}
              onChange={(e) => {
                state.content = e.target.value;
                saveDraft(e.target.value);
              }}
              onKeyDown={(e: any) => {
                if ([91, 17, 18, 11].includes(e.keyCode)) {
                  state.activeKeyA = true;
                } else if (e.keyCode === 13) {
                  state.activeKeyB = true;
                }
                if (state.activeKeyA && state.activeKeyB) {
                  state.activeKeyA = false;
                  state.activeKeyB = false;
                  submit();
                }
              }}
              onKeyUp={(e: any) => {
                if ([91, 17, 18, 11].includes(e.keyCode)) {
                  state.activeKeyA = false;
                } else if (e.keyCode === 13) {
                  state.activeKeyB = false;
                }
              }}
            />
            {state.loading && (
              <div className="absolute top-0 left-0 w-full z-10 bg-white opacity-60 flex items-center justify-center h-full">
                <div className="mt-[-6px]">
                  <Loading
                    size={props.minRows && props.minRows > 1 ? 24 : 16}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {(state.clickedEditor ||
        !props.hideButtonDefault ||
        (props.minRows && props.minRows > 1)) && (
        <div className="mt-1 flex justify-end">
          <Tooltip
            enterDelay={1500}
            enterNextDelay={1500}
            placement="left"
            title="快捷键：Ctrl + Enter 或 Cmd + Enter"
            arrow
            interactive
          >
            <div className={props.buttonClassName || ''}>
              <Button
                size="small"
                className={classNames({
                  'opacity-30': !state.content.trim() || state.loading,
                })}
                onClick={submit}
              >
                发布
              </Button>
            </div>
          </Tooltip>
        </div>
      )}
      <style jsx global>{`
        .textarea-autosize {
          color: rgba(0, 0, 0, 0.87);
          font-size: 14px;
          padding: 14px;
          font-weight: normal;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
          border-radius: 8px;
          resize: none;
        }
        .textarea-autosize.sm {
          font-size: 13px;
          padding: 10px 14px;
        }
        .textarea-autosize:focus {
          border-color: #333 !important;
          outline: none;
        }
      `}</style>
    </div>
  );
});
