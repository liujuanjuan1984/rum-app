import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { observer, useLocalObservable } from 'mobx-react-lite';
import Dialog from 'components/Dialog';
import { StoreProvider, useStore } from 'store';
import { ThemeRoot } from 'utils/theme';
import Switch from '@material-ui/core/Switch';
import fs from 'fs-extra';
import TOML from '@iarna/toml';
import Button from 'components/Button';
import { lang } from 'utils/lang';
import { app } from '@electron/remote';
import sleep from 'utils/sleep';
import Fade from '@material-ui/core/Fade';
import { replaceSeedAsButton } from 'utils/replaceSeedAsButton';
import { DEV_NETWORK_BOOTSTRAPS, BOOTSTRAPS } from 'utils/constant';
import { isEqual } from 'lodash';
import LabIcon from 'assets/icon_lab.svg';
import path from 'path';

export default () => {
  const div = document.createElement('div');
  document.body.append(div);
  const unmount = () => {
    unmountComponentAtNode(div);
    div.remove();
  };
  render(
    (
      <ThemeRoot>
        <StoreProvider>
          <BetaFeaturesModal
            rs={() => {
              setTimeout(unmount, 3000);
            }}
          />
        </StoreProvider>
      </ThemeRoot>
    ),
    div,
  );
};

const BetaFeaturesModal = observer((props: any) => {
  const state = useLocalObservable(() => ({
    open: true,
    tomlObj: {} as any,
    prevTomlObj: {} as any,
    get reloadRequired() {
      return !isEqual(state.prevTomlObj, state.tomlObj);
    },
  }));
  const bugReportSeedButtonRef = React.useRef<HTMLDivElement>(null);
  const { betaFeatureStore, nodeStore } = useStore();

  const handleClose = () => {
    state.open = false;
    props.rs();
  };

  React.useEffect(() => {
    (async () => {
      try {
        const toml = await fs.readFile(
          path.join(nodeStore.storagePath, 'peerConfig', 'peer_options.toml'),
          'utf8',
        );
        state.tomlObj = TOML.parse(toml);
        state.prevTomlObj = TOML.parse(toml);
      } catch (err) {
        console.log(err);
      }
    })();
  }, []);

  React.useEffect(() => {
    setTimeout(() => {
      if (bugReportSeedButtonRef.current) {
        replaceSeedAsButton(bugReportSeedButtonRef.current);
      }
    }, 1);
  }, []);

  const saveTomlObj = async (tomlObj: any) => {
    try {
      await fs.writeFile(
        path.join(nodeStore.storagePath, 'peerConfig', 'peer_options.toml'),
        TOML.stringify(tomlObj),
      );
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <Dialog
      open={state.open}
      onClose={() => {
        handleClose();
      }}
      hideCloseButton
      transitionDuration={{
        enter: 300,
      }}
    >
      <div className="bg-gray-33 rounded-0 py-10">
        <div className="w-140 text-gray-9c px-12 pt-2 max-h-[60vh]">
          <div className="leading-relaxed text-12">
            <div className="flex">
              <img
                className="w-22"
                src={LabIcon}
                alt='lab'
              />
              <div className="ml-5">
                <div className="text-18 font-bold text-blue-400">Rum 实验室</div>
                <div className="mt-1">
                  欢迎提前体验Rum应用中的还未正式发布的实验性功能，
                  <br />
                  你可以在下面列表里选择开启或关闭。
                  <br />
                  实验性功能可能不够完善或服务不够稳定。
                </div>
              </div>
            </div>
            <div className="mt-3">
              您可以加入种子网络:<span ref={bugReportSeedButtonRef} onClick={handleClose}>{'{"genesis_block": {"BlockId": "ede51867-559f-4ef6-aca6-3296c9825363", "GroupId": "a9223277-39ff-40d1-9908-3ecba139e2c0", "ProducerPubKey": "CAISIQIxG1a23xQfgvhLqeBtpNAvSiCe1o48DNnauQQ+6eyMwg==", "Hash": "4AZmQB3Ydbgn1jHeoAfGfnEXSFjZZhTwJ1J1Lr4Erh0=", "Signature": "MEUCIQDLmuU2VWJqZ9nZw6bhVKFPSdxd3D8sGzVvWBw5OuRhnwIgNZmseqfhEIZ/8/fhnBLrKW8Yzqzvf/fjwg5nHe6ipz8=", "TimeStamp": "1637571648704703300"}, "group_id": "a9223277-39ff-40d1-9908-3ecba139e2c0", "group_name": "RUM产品建议与bug反馈", "owner_pubkey": "CAISIQIxG1a23xQfgvhLqeBtpNAvSiCe1o48DNnauQQ+6eyMwg==", "consensus_type": "poa", "encryption_type": "public", "cipher_key": "da4cb54661aaf2b7c710cc0af0a40aaa7c22bc622a9fda2fdaf0acb7c5c94934", "app_key": "group_post", "signature": "30450221008c3ad34c29017a906cd26de9d2e1548795bfb383523f3e71df4ff6822d321f41022079d0392f3b0d70c9c7458d8c17259fd008a5d8d36f4f0059bd6f8d5e57c90a0e"}'}</span>提供反馈，协助我们不断改进。
            </div>
          </div>
          <div className="pt-5 border-b border-gray-6d" />
          <Fade in={true} timeout={300}>
            <div className="pb-5">
              <div className="flex justify-between items-center mt-4 py-2 px-4">
                <div>
                  <div className="text-white font-bold">支付功能</div>
                  <div className="mt-1 text-gray-99 text-12">可以创建收费的种子网络</div>
                </div>
                <Switch
                  checked={betaFeatureStore.betaFeatures.includes('PAID_GROUP')}
                  color='primary'
                  onClick={() => {
                    betaFeatureStore.toggle('PAID_GROUP');
                  }}
                />
              </div>
              <div className="flex justify-between items-center rounded mt-3 py-2 px-4 relative">
                <div>
                  <div className="text-white font-bold">Rum Exchange</div>
                  <div className="mt-1 text-gray-99 text-12">主动寻找 public 节点，提高网络的联通性</div>
                </div>
                <Switch
                  checked={!!state.tomlObj.enablerumexchange}
                  color='primary'
                  onClick={() => {
                    state.tomlObj.enablerumexchange = !state.tomlObj.enablerumexchange;
                    saveTomlObj(state.tomlObj);
                  }}
                />
                {state.prevTomlObj.enablerumexchange !== state.tomlObj.enablerumexchange && (
                  <div className="text-red-400 text-12 right-2 bottom-[-3px] absolute transform scale-90 opacity-90">
                    重启之后生效
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center rounded mt-3 py-2 px-4 relative">
                <div>
                  <div className="text-white font-bold">Dev Network</div>
                  <div className="mt-1 text-gray-99 text-12">连接到测试网，用于内部功能测试</div>
                </div>
                <Switch
                  checked={!!state.tomlObj.enabledevnetwork}
                  color='primary'
                  onClick={() => {
                    state.tomlObj.enabledevnetwork = !state.tomlObj.enabledevnetwork;
                    state.tomlObj.bootstraps = (state.tomlObj.enabledevnetwork ? DEV_NETWORK_BOOTSTRAPS : BOOTSTRAPS).join(',');
                    saveTomlObj(state.tomlObj);
                  }}
                />
                {state.prevTomlObj.enabledevnetwork !== state.tomlObj.enabledevnetwork && (
                  <div className="text-red-400 text-12 right-2 bottom-[-3px] absolute transform scale-90 opacity-90">
                    重启之后生效
                  </div>
                )}
              </div>
            </div>
          </Fade>
          {state.reloadRequired && (
            <div className="flex flex-center pb-1">
              <Button
                color='red'
                outline
                onClick={async () => {
                  handleClose();
                  await sleep(300);
                  app.relaunch();
                  app.quit();
                }}
              >
                {lang.relaunch}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
});
