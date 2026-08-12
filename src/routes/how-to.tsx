import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/how-to')({
  component: HowTo,
});

function HowTo() {
  return <div className="p-8">Help Page</div>;
}
