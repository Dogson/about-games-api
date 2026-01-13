export function isAxiosError(err: unknown): err is {
  response: { data: { error: { message: string } }; status: number };
} {
  return (
    err !== null &&
    typeof err === 'object' &&
    'response' in err &&
    err.response !== null &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data !== null &&
    typeof err.response.data === 'object' &&
    'error' in err.response.data &&
    err.response.data.error !== null &&
    typeof err.response.data.error === 'object' &&
    'message' in err.response.data.error
  );
}
