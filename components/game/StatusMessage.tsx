type Props = {
  message: string;
};

export function StatusMessage({ message }: Props) {
  return (
    <div className="rounded-2xl bg-slate-900/75 px-3 py-2 text-center text-sm text-white shadow-sm backdrop-blur">
      {message}
    </div>
  );
}
