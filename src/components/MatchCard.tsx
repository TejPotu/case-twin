import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type Match } from "@/lib/mockData";

interface MatchCardProps {
  match: Match;
  onViewDetails: (match: Match) => void;
}

export function MatchCard({ match, onViewDetails }: MatchCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative space-y-4 pt-5">
        <div className="absolute inset-y-0 left-0 w-1 bg-blue-500/80" />

        <div className="flex flex-wrap items-start justify-between gap-3 pl-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{match.facility}</p>
            <p className="text-sm text-slate-500">{match.country}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{match.similarity}% similarity</Badge>
            <Badge variant="secondary">{match.outcome}</Badge>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pl-3">
          <p className="text-sm text-slate-700">Diagnosis: {match.diagnosis}</p>
          <Button variant="secondary" size="sm" onClick={() => onViewDetails(match)}>
            View details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
