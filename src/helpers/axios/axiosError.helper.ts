/* eslint-disable @typescript-eslint/no-unsafe-member-access */
export function isAxiosError(err: any): err is {
  response: { data: { error: { message: string } }; status: number };
} {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
