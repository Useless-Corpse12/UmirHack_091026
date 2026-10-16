import { authApi } from "../../shared/api/authApi";
import { useMutation } from "../../shared/lib/useMutation";
export const useLogin = () => {
  const action = useMutation(authApi.login);
  return { ...action, login: action.run };
};
export const useRegister = () => {
  const action = useMutation(authApi.register);
  return { ...action, registerUser: action.run };
};
export const useVerifyEmail = () => {
  const action = useMutation(authApi.verify);
  return { ...action, verify: action.run };
};
export const useResendCode = () => {
  const action = useMutation(authApi.resend);
  return { ...action, resend: action.run };
};
