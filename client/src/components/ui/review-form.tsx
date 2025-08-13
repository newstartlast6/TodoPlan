import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useReview } from "@/hooks/use-reviews";
import { useGoal } from "@/hooks/use-goals";
import { format, startOfWeek, endOfWeek, getWeek } from "date-fns";

type ReviewType = "daily" | "weekly";

export interface ReviewFormProps {
  type: ReviewType;
  anchorDate: Date;
}

export function ReviewForm({ type, anchorDate }: ReviewFormProps) {
  const { review, upsert } = useReview(type, anchorDate);
  const { goal } = useGoal(type, anchorDate);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState<number | undefined>();
  const [achieved, setAchieved] = useState<boolean | null>(null);
  const [achievedReason, setAchievedReason] = useState<string>("");
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [satisfiedReason, setSatisfiedReason] = useState<string>("");
  const [improvements, setImprovements] = useState<string>("");
  const [biggestWin, setBiggestWin] = useState<string>("");
  const [topChallenge, setTopChallenge] = useState<string>("");
  const [topDistraction, setTopDistraction] = useState<string>("");
  const [nextFocusPlan, setNextFocusPlan] = useState<string>("");
  const [energyLevel, setEnergyLevel] = useState<number | undefined>();
  const [mood, setMood] = useState<string>("");
  const [weeklyAchievedState, setWeeklyAchievedState] = useState<"yes" | "partially" | "no" | null>(null);

  // Sync state when review loads/changes
  useEffect(() => {
    setRating(review?.productivityRating ?? undefined);
    setAchieved((review?.achievedGoal ?? null) as boolean | null);
    setAchievedReason(review?.achievedGoalReason ?? "");
    setSatisfied((review?.satisfied ?? null) as boolean | null);
    setSatisfiedReason(review?.satisfiedReason ?? "");
    setImprovements(review?.improvements ?? "");
    setBiggestWin(review?.biggestWin ?? "");
    setTopChallenge(review?.topChallenge ?? "");
    setTopDistraction(review?.topDistraction ?? "");
    setNextFocusPlan(review?.nextFocusPlan ?? "");
    setEnergyLevel(review?.energyLevel ?? undefined);
    setMood(review?.mood ?? "");
  }, [review]);

  const onSave = async () => {
    setSaving(true);
    try {
      await upsert({
        productivityRating: typeof rating === "number" ? rating : undefined,
        goalAchievementStatus: weeklyAchievedState ?? null,
        achievedGoal: achieved,
        achievedGoalReason: achieved ? null : achievedReason || null,
        satisfied: satisfied,
        satisfiedReason: satisfied ? null : satisfiedReason || null,
        improvements: improvements || null,
        biggestWin: biggestWin || null,
        topChallenge: topChallenge || null,
        topDistraction: topDistraction || null,
        nextFocusPlan: nextFocusPlan || null,
        energyLevel: typeof energyLevel === "number" ? energyLevel : undefined,
        mood: mood || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const friendlyDate = type === 'daily'
    ? format(anchorDate, 'EEEE, MMM d, yyyy')
    : `Week ${getWeek(anchorDate, { weekStartsOn: 1 })} • ${format(startOfWeek(anchorDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(anchorDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;

  return (
    <Card className="bg-white border-l border-gray-100 rounded-none shadow-none">
      <CardHeader className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3 mb-1">
          <div className="w-2 h-2 bg-primary rounded-full"></div>
          <h3 className="text-lg font-semibold text-gray-900">
            {type === 'daily' ? 'Daily Review' : 'Weekly Review'}
          </h3>
        </div>
        <p className="text-sm text-gray-600 leading-none">{friendlyDate}</p>
      </CardHeader>
      <CardContent className="space-y-7 p-7">
        <div className="space-y-3">
          <Label className="block text-sm font-medium text-gray-900 mb-3">
            {type === 'daily' ? 'Rate your day from 1 to 10 about productivity' : 'Rate your week from 1 to 10 about productivity'}
          </Label>
          <div className="flex gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`w-10 h-10 rounded-md border transition-colors flex items-center justify-center text-sm font-medium ${
                  rating === n
                    ? 'bg-primary text-white border-primary'
                    : 'border-gray-200 hover:bg-orange-50 hover:border-primary'
                }`}
                onClick={() => setRating(n)}
                aria-pressed={rating === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {type === 'weekly' && (
          <>
            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-900 mb-2">Have you achieved your weekly goal?</Label>
              <div role="radiogroup" className="grid gap-2">
                <div className="flex items-center space-x-2">
                  <button type="button" role="radio" aria-checked={weeklyAchievedState === 'yes'} onClick={() => setWeeklyAchievedState('yes')} className={`aspect-square h-4 w-4 rounded-full border border-primary text-primary`} />
                  <label className="text-sm font-medium leading-none">Yes, completely</label>
                </div>
                <div className="flex items-center space-x-2">
                  <button type="button" role="radio" aria-checked={weeklyAchievedState === 'partially'} onClick={() => setWeeklyAchievedState('partially')} className={`aspect-square h-4 w-4 rounded-full border border-primary text-primary`}>
                    {weeklyAchievedState === 'partially' && (
                      <span className="flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5 fill-current text-current"><circle cx="12" cy="12" r="10"></circle></svg>
                      </span>
                    )}
                  </button>
                  <label className="text-sm font-medium leading-none">Partially</label>
                </div>
                <div className="flex items-center space-x-2">
                  <button type="button" role="radio" aria-checked={weeklyAchievedState === 'no'} onClick={() => setWeeklyAchievedState('no')} className={`aspect-square h-4 w-4 rounded-full border border-primary text-primary`} />
                  <label className="text-sm font-medium leading-none">No, not at all</label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-900 mb-2">If not, why?</Label>
              <Textarea className="h-24 resize-none border border-gray-200" placeholder="Explain what prevented you from achieving your goal..." value={achievedReason} onChange={(e) => setAchievedReason(e.target.value)} />
            </div>

            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-900 mb-2">How was your week?</Label>
              <Textarea className="h-32 resize-none border border-gray-200" placeholder="Reflect on your week overall..." value={mood} onChange={(e) => setMood(e.target.value)} />
            </div>

            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-900 mb-2">What could you have done differently to make this week better?</Label>
              <Textarea className="h-32 resize-none border border-gray-200" placeholder="Areas for improvement and changes for next week..." value={improvements} onChange={(e) => setImprovements(e.target.value)} />
            </div>
          </>
        )}

        {type === 'daily' && (
          <>
            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-900 mb-2">How was your day?</Label>
              <Textarea className="h-32 resize-none border border-gray-200" placeholder="Reflect on your day overall..." value={mood} onChange={(e) => setMood(e.target.value)} />
            </div>

            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-900 mb-2">Did you get distracted? If yes, why?</Label>
              <Textarea className="h-24 resize-none border border-gray-200" placeholder="Note any distractions..." value={topDistraction} onChange={(e) => setTopDistraction(e.target.value)} />
            </div>

            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-900 mb-2">What could you have done differently?</Label>
              <Textarea className="h-24 resize-none border border-gray-200" placeholder="Areas for improvement..." value={improvements} onChange={(e) => setImprovements(e.target.value)} />
            </div>
          </>
        )}

        <div className="space-y-3">
          <Label className="block text-sm font-medium text-gray-900 mb-2">Did you achieve the {type === 'daily' ? 'Daily' : 'Weekly'} Goal?</Label>
          {!!goal && (
            <div className="text-xs text-muted-foreground -mt-1">Goal: <span className="font-medium text-foreground/90">{goal}</span></div>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" variant={achieved === true ? 'default' : 'outline'} size="sm" onClick={() => setAchieved(true)}>Yes</Button>
            <Button type="button" variant={achieved === false ? 'destructive' : 'outline'} size="sm" onClick={() => setAchieved(false)}>No</Button>
          </div>
          {achieved === false && (
            <Textarea className="border border-gray-200" placeholder="If no, why?" value={achievedReason} onChange={(e) => setAchievedReason(e.target.value)} />
          )}
        </div>

        <div className="space-y-3">
          <Label className="block text-sm font-medium text-gray-900 mb-2">Are you satisfied with {type === 'daily' ? "today's" : "this week's"} progress?</Label>
          <div className="flex items-center gap-3">
            <Button type="button" variant={satisfied === true ? 'default' : 'outline'} size="sm" onClick={() => setSatisfied(true)}>Yes</Button>
            <Button type="button" variant={satisfied === false ? 'destructive' : 'outline'} size="sm" onClick={() => setSatisfied(false)}>No</Button>
          </div>
          {satisfied === false && (
            <Textarea className="border border-gray-200" placeholder="If no, why?" value={satisfiedReason} onChange={(e) => setSatisfiedReason(e.target.value)} />
          )}
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">What could you do better?</Label>
          <Textarea
            className="border border-gray-200"
            placeholder="Your reflection"
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">What was your biggest win?</Label>
          <Textarea className="border border-gray-200" placeholder="A moment you’re proud of" value={biggestWin} onChange={(e) => setBiggestWin(e.target.value)} />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">What was your biggest challenge?</Label>
          <Textarea
            className="border border-gray-200"
            placeholder="What blocked you the most?"
            value={topChallenge}
            onChange={(e) => setTopChallenge(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Top distraction</Label>
          <Textarea
            className="border border-gray-200"
            placeholder="What distracted you most?"
            value={topDistraction}
            onChange={(e) => setTopDistraction(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Energy level (1–10)</Label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={`energy-${n}`}
                type="button"
                className={`h-8 w-8 rounded-md border text-xs font-semibold transition-all ${
                  energyLevel === n
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow'
                    : 'bg-background hover:bg-muted/60 text-foreground border-border'
                }`}
                onClick={() => setEnergyLevel(n)}
                aria-pressed={energyLevel === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Mood</Label>
          <Textarea
            className="border border-gray-200"
            placeholder="How did you feel overall?"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Plan for next {type === 'daily' ? 'day' : 'week'}</Label>
          <Textarea className="border border-gray-200" placeholder={type === 'daily' ? 'One thing to focus on tomorrow' : 'Top priorities for next week'} value={nextFocusPlan} onChange={(e) => setNextFocusPlan(e.target.value)} />
        </div>

        <div className="p-0 pt-2 border-t border-gray-100">
          <div className="flex space-x-3">
            <Button className="text-primary-foreground h-10 px-4 py-2 bg-primary hover:bg-primary/90" onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Review'}
            </Button>
            <Button variant="outline" onClick={() => {
            setRating(undefined);
            setAchieved(null);
            setAchievedReason("");
            setSatisfied(null);
            setSatisfiedReason("");
            setImprovements("");
            setBiggestWin("");
            setTopChallenge("");
            setTopDistraction("");
            setNextFocusPlan("");
            setEnergyLevel(undefined);
            setMood("");
            }}>Reset</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


