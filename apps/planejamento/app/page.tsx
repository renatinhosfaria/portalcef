import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";

export default function Page() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Planejamento</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Design System Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Checking brand colors.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="default">Primary Action (Orange)</Button>
              <Button variant="secondary">Secondary Action (Green)</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
