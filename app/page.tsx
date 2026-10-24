import FishingRoot from './fishing-root';

// This page contains no session or user data and is rendered at build time.
export const dynamic = 'force-static';

export default function Home() {
  return <FishingRoot />;
}
