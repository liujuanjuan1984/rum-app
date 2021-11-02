import React from 'react';
import * as Quorum from 'utils/quorum';
import { ipcRenderer } from 'electron';
import externalNodeMode from '../utils/storages/externalNodeMode';
import useDatabase, { Database } from 'hooks/useDatabase';
import useOffChainDatabase, {
  OffChainDatabase,
} from 'hooks/useOffChainDatabase';
import * as offChainDatabaseExportImport from 'hooks/useOffChainDatabase/exportImport';
import { sleep } from 'utils';
import { Store, useStore } from 'store';

interface IOptions {
  store: Store
  database: Database
  offChainDatabase: OffChainDatabase
}

export default () => {
  const store = useStore();
  const database = useDatabase();
  const offChainDatabase = useOffChainDatabase();
  const options = {
    store,
    database,
    offChainDatabase,
  };

  React.useEffect(() => {
    ipcRenderer.on('toggle-enabled-external-node-mode', () => {
      toggleEnabledExternalNodeMode(options);
    });
    ipcRenderer.on('clean-local-data', () => {
      cleanLocalData(options);
    });
  }, []);
};

async function toggleEnabledExternalNodeMode(options: IOptions) {
  const { store } = options;
  if (externalNodeMode.enabled()) {
    externalNodeMode.disable();
  } else {
    externalNodeMode.enable();
  }
  store.modalStore.pageLoading.show();
  store.nodeStore.setQuitting(true);
  store.groupStore.resetElectronStore();
  store.nodeStore.resetElectronStore();
  if (store.nodeStore.status.up) {
    await Quorum.down();
  }
  window.location.reload();
}

function cleanLocalData(options: IOptions) {
  const { groupStore, nodeStore, confirmDialogStore } = options.store;
  confirmDialogStore.show({
    content: '确定清除客户端的缓存数据吗？',
    okText: '确定',
    isDangerous: true,
    ok: async () => {
      groupStore.resetElectronStore();
      options.database.delete();
      await offChainDatabaseExportImport.remove(
        options.offChainDatabase,
        nodeStore.storagePath,
      );
      await sleep(300);
      window.location.reload();
    },
  });
}
