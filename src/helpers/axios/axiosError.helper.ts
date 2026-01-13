export function isAxiosError(err: unknown): err is {
  response: { data: { error: { message: string } }; status: number };
} {
  return (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    'data' in err.response &&
    err.response.data &&
    'error' in err.response.data &&
    err.response.data.error &&
    'message' in err.response.data.error
  );
}
