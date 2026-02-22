export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="rounded-full bg-muted p-4 mb-4">
        <div className="h-8 w-8 rounded-full bg-accent/20" />
      </div>
      <h1 className="text-lg font-bold text-foreground mb-1">{title}</h1>
      <p className="text-sm text-muted-foreground">Coming soon</p>
    </div>
  );
}
