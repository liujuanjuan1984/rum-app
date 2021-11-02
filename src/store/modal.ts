interface IPaymentProps {
  title?: string;
  currency: string;
  getPaymentUrl: any;
  checkResult: any;
  done: any;
}

interface IQuickPaymentProps {
  skipVerification?: boolean;
  amount: string;
  currency: string;
  getPaymentUrl: any;
  checkResult: any;
  done: any;
}

export function createModalStore() {
  return {
    auth: {
      open: false,
      show() {
        this.open = true;
      },
      hide() {
        this.open = false;
      },
    },
    verification: {
      open: false,
      pass: (() => {}) as any,
      show(props: any) {
        this.open = true;
        this.pass = props.pass;
      },
      hide() {
        this.open = false;
      },
    },
    payment: {
      open: false,
      props: {} as IPaymentProps,
      show(props: IPaymentProps) {
        this.open = true;
        this.props = props;
      },
      hide() {
        this.open = false;
      },
    },
    quickPayment: {
      open: false,
      props: {} as IQuickPaymentProps,
      show(props: IQuickPaymentProps) {
        this.open = true;
        this.props = props;
      },
      hide() {
        this.open = false;
      },
    },
  };
}
