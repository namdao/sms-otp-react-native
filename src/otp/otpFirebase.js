import React, { Component } from 'react';
import { View, Text, Platform, TouchableOpacity, Alert } from 'react-native';
import PropTypes from 'prop-types';
import Colors from '../utils/colors';
import OTPInput from '../components/OTPInput';
import styles from './styles';
import KeyboardAware from '../components/KeyboardAware';
import Countdown from '../components/Countdown';
import { withOTPFirebaseBusinessLogic } from './logicFirebase';
import AuthenConfig from '../AuthenConfig';
import ModalConfirmResend from '../components/ModalConfirmResend';
import Loading from '../components/Loading';
import { debounce } from '../utils/utility';

const PIN_COUNT = 6;
class OTPScreen extends Component {
  constructor(props) {
    super(props);
    this.state = {
      code: '',
      isCodeFilled: false,
      isLoading: false,
      isCountingDone: true,
      hash: '',
      errorMessage: '',
    };
    this.countDown = null;
    this.modal = null;
    this.debouncedOnSubmit = debounce(this.onSubmit, 200);
    this.debouncedOnResendOTP = debounce(this.onResendOTP, 200);
  }

  componentDidMount() {
    this.onSendOTPFirstTime();
    const { subscriber } = this.props;
    const listenerChange = (user) => {
      if (user && Platform.OS === 'android') {
        this.callBackSuccess(user);
      }
    }
    subscriber(listenerChange);
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.currentPhoneNumber !== this.props.currentPhoneNumber &&
      !!prevProps.currentPhoneNumber
    ) {
      this.isCountingDone = true;
      this.countDown && this.countDown.reset();
      this.OTPInputRef && this.OTPInputRef.clearDigits();
      this.setState(
        {
          code: '',
          isCodeFilled: false,
          isLoading: false,
          errorMessage: '',
        }
      );
      this.onResendOTP()
    }
  }
  // eslint-disable-next-line no-unused-vars
  shouldComponentUpdate(nextProps, nextState) {
    const { isCodeFilled, isLoading, isCountingDone, errorMessage } = this.state;
    const {
      isCodeFilled: nextIsCodeFilled,
      isLoading: nextIsLoading,
      isCountingDone: nextIsCountingDone,
      errorMessage: nextMessage,
    } = nextState;
    const { currentPhoneNumber: nextPhoneNumber } = nextProps;
    const { currentPhoneNumber } = this.props;
    const validState = (isCodeFilled !== nextIsCodeFilled ||
      isLoading !== nextIsLoading ||
      isCountingDone !== nextIsCountingDone ||
      errorMessage !== nextMessage);
    const validProps = currentPhoneNumber !== nextPhoneNumber
    return (
      validState || validProps
    );
  }

  checkIsCodeFilled = code => {
    this.setState({ code, isCodeFilled: code.length === PIN_COUNT, errorMessage: '' });
  };

  onSubmit = () => {
    const { code, isCodeFilled } = this.state;
    const { verifyOTP } = this.props;
    if (!isCodeFilled) return;

    this.startLoading();
    verifyOTP(code, this.afterSubmitCode);
  };

  afterSubmitCode = ({ status, error, resultConfirm }) => {
    if (!status) {
      this.setState({ errorMessage: JSON.stringify(error) });
    } else {
      this.callBackSuccess(resultConfirm);
    }
    this.endLoading();
  }

  callBackSuccess = (data) => {
    const { onOTPSuccess } = AuthenConfig.getConfig();
    onOTPSuccess(data);
  }

  sendOTP = () => {
    const { sendOTP: businessSendOTP, currentPhoneNumber } = this.props;
    const { hash } = this.state;
    this.startLoading();
    businessSendOTP(currentPhoneNumber, this.afterSendOtp);
  };

  afterSendOtp = ({ status, error }) => {
    if (!status) {
      Alert.alert(JSON.stringify(error));
    }
    setTimeout(() => {
      this.endLoading();
    }, 500);
  }

  onSendOTPFirstTime = () => {
    this.countDown.clearRemaining(() => {
      this.sendOTP();
    });
  };

  onResendOTP = () => {
    const { isCountingDone } = this.state;
    if (isCountingDone) {
      if (this.modal) {
        this.modal.closeModal();
      }
      this.startCount();
      this.sendOTP();
    }
  };

  startCount = () => {
    if (this.countDown) {
      this.countDown.start(0);
    }
  };

  onCountingDone = () => {
    this.setState({ isCountingDone: true });
  };

  onCountingStart = () => {
    this.setState({ isCountingDone: false });
  };

  openModal = () => {
    const { isCountingDone } = this.state;
    if (!isCountingDone) return;

    this.modal.openModal();
  };

  startLoading = () => {
    this.setState({ isLoading: true }, () => {
      this.startCount(0);
    });
  };

  endLoading = () => {
    this.setState({ isLoading: false }, () => {
      this.startCount(0);
    });
  };

  renderErrorMessage = () => {
    const { errorMessage } = this.state;
    return !!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>;
  };

  render() {
    const { isLoading, errorMessage, isCountingDone } = this.state;
    const { phoneAlias } = this.props;
    const { colorsMain = Colors.main } = AuthenConfig.getConfig() || {};
    const styleError = errorMessage ? styles.inputError : null;
    return (
      <KeyboardAware>
        <View style={styles.container}>
          <Text style={[styles.title, styles.mb10]}>Mã xác nhận </Text>
          <Text style={styles.text}>
            Nhập mã xác nhận đã gửi qua số{' '}
            <Text style={styles.boldText}>{phoneAlias || 'Không xác định'}</Text>
          </Text>
          <OTPInput
            containerStyle={styles.otpInputContainer}
            pinCount={PIN_COUNT}
            autoFocusOnLoad
            onCodeChanged={this.checkIsCodeFilled}
            codeInputFieldStyle={[styles.input, styleError]}
            codeInputFieldEmptyStyle={styles.inputEmpty}
            textInputProps={{
              selectionColor: Platform.OS === 'ios' ? Colors.black : Colors.black20,
            }}
            ref={this.setOTPInputRef}
          />
          {this.renderErrorMessage()}
          <TouchableOpacity
            onPress={this.debouncedOnSubmit}
            style={[styles.submitButton, styles.mt15, { backgroundColor: colorsMain }]}
          >
            <Text style={styles.whiteText}>Xác nhận</Text>
          </TouchableOpacity>
          <Countdown
            onCountingStart={this.onCountingStart}
            onCountingDone={this.onCountingDone}
            ref={this.setCountdownRef}
          />
          {isCountingDone && (
            <View style={styles.bottom}>
              <TouchableOpacity onPress={this.openModal} style={styles.resendButton}>
                <Text style={styles.orangeText}>Gửi lại mã xác nhận?</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <ModalConfirmResend
          phoneNumber={phoneAlias}
          ref={this.setModalRef}
          onConfirm={this.debouncedOnResendOTP}
        />
        <Loading isLoading={isLoading} />
      </KeyboardAware>
    );
  }

  setCountdownRef = ref => {
    this.countDown = ref;
  };

  setModalRef = ref => {
    this.modal = ref;
  };

  setOTPInputRef = ref => {
    this.OTPInputRef = ref;
  };
}

OTPScreen.propTypes = {
  currentPhoneNumber: PropTypes.string,
  phoneAlias: PropTypes.string,
  sendOTP: PropTypes.func,
  verifyOTP: PropTypes.func,
};

OTPScreen.defaultProps = {
  currentPhoneNumber: '',
  phoneAlias: '',
  sendOTP: () => null,
  verifyOTP: () => null,
};

export default withOTPFirebaseBusinessLogic(OTPScreen);

