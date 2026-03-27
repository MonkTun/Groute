import { SPORT_LABELS } from "@groute/shared";

export default function Home() {
  const sports = Object.values(SPORT_LABELS);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-8">
        <h1 className="text-5xl font-bold tracking-tight text-black dark:text-white">
          Groute
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400 text-center max-w-md">
          Find your outdoor crew. Verified skills, real people, spontaneous
          adventures.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {sports.map((sport) => (
            <span
              key={sport}
              className="rounded-full bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {sport}
            </span>
          ))}
        </div>
        <p className="text-sm text-zinc-400 mt-8">
          Phase 1: Discovery MVP — Coming to LA
        </p>
      </main>
    </div>
  );
}
