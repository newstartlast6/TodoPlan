import { format, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth, isSameMonth, isThisMonth, isPast } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { Task } from "@shared/schema";
import { calculateYearProgress, getUrgencyClass } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

interface YearViewProps {
  tasks: Task[];
  currentDate: Date;
  onMonthClick: (date: Date) => void;
}

export function YearView({ tasks, currentDate, onMonthClick }: YearViewProps) {
  const { selectedTodoId, selectTodo } = useSelectedTodo();
  const yearStart = startOfYear(currentDate);
  const yearEnd = endOfYear(currentDate);
  const yearProgress = calculateYearProgress(currentDate);
  
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  const getTasksForMonth = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    return tasks.filter(task => {
      const taskDate = new Date(task.startTime);
      return taskDate >= monthStart && taskDate <= monthEnd;
    });
  };

  const getMonthStatus = (month: Date) => {
    if (isThisMonth(month)) return 'current';
    if (isPast(endOfMonth(month))) return 'completed';
    return 'future';
  };

  const getCompletedTasksForMonth = (month: Date) => {
    const monthTasks = getTasksForMonth(month);
    return monthTasks.filter(task => task.completed).length;
  };

  const completedTasks = tasks.filter(task => task.completed);
  const totalTasks = tasks.length;

  return (
    <div className="space-y-8" data-testid="year-view">
      {/* Year Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="year-title">
              {format(currentDate, "yyyy")}
            </h2>
            <p className="text-muted-foreground mt-1" data-testid="year-summary">
              {Math.floor(yearProgress.elapsed / 100 * 12)} months completed • {12 - Math.floor(yearProgress.elapsed / 100 * 12)} months remaining
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <UrgencyViewSimple 
              tasks={tasks} 
              currentDate={currentDate} 
              view="year"
              className="w-64"
            />
          </div>
        </div>
      </div>

      {/* Months Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="months-grid">
        {months.map((month, monthIndex) => {
          const monthTasks = getTasksForMonth(month);
          const monthStatus = getMonthStatus(month);
          const completedMonthTasks = getCompletedTasksForMonth(month);
          const isCurrentMonth = isThisMonth(month);
          const isMonthCompleted = monthStatus === 'completed';

          return (
            <Card
              key={monthIndex}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isMonthCompleted && "crossed-out opacity-75",
                isCurrentMonth && "border-2 border-primary bg-accent"
              )}
              onClick={() => onMonthClick(month)}
              data-testid={`month-card-${monthIndex}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground" data-testid={`month-title-${monthIndex}`}>
                    {format(month, "MMMM")}
                  </h3>
                  {isCurrentMonth && (
                    <Badge className="bg-primary text-primary-foreground text-xs">Current</Badge>
                  )}
                  {isMonthCompleted && (
                    <Badge className="bg-green-100 text-green-700 text-xs">Done</Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {/* Task Summary */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tasks</span>
                    <span className="font-medium" data-testid={`month-task-count-${monthIndex}`}>
                      {completedMonthTasks}/{monthTasks.length}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  {monthTasks.length > 0 && (
                    <Progress 
                      value={(completedMonthTasks / monthTasks.length) * 100} 
                      className="h-2" 
                      data-testid={`month-progress-${monthIndex}`}
                    />
                  )}
                  
                   {/* Priority section removed */}
                  
                  {/* Recent/Upcoming Tasks Preview */}
                  {monthTasks.length > 0 ? (
                    <div className="space-y-1">
                      {monthTasks.slice(0, 2).map((task, taskIndex) => (
                        <div
                          key={task.id}
                          className={cn(
                            "text-xs p-2 rounded truncate cursor-pointer transition-all",
                            "hover:ring-1 hover:ring-primary/50",
                            selectedTodoId === task.id && "ring-1 ring-primary bg-primary/10",
                             task.completed 
                               ? "bg-green-100 text-green-700 line-through" 
                               : "bg-muted text-muted-foreground"
                          )}
                          title={task.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTodo(task.id);
                          }}
                          data-testid={`month-task-preview-${monthIndex}-${taskIndex}`}
                        >
                          {task.title}
                        </div>
                      ))}
                      {monthTasks.length > 2 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{monthTasks.length - 2} more tasks
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-center text-muted-foreground py-2">
                      No tasks scheduled
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Year Summary */}
      <Card data-testid="year-summary-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Year Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600" data-testid="summary-completed">
                {completedTasks.length}
              </div>
              <div className="text-sm text-muted-foreground">Tasks Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary" data-testid="summary-remaining">
                {totalTasks - completedTasks.length}
              </div>
              <div className="text-sm text-muted-foreground">Tasks Remaining</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getUrgencyClass(yearProgress.urgencyLevel)}`} data-testid="summary-year-progress">
                {Math.round(yearProgress.percentage)}%
              </div>
              <div className="text-sm text-muted-foreground">Year Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground" data-testid="summary-efficiency">
                {totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Overall Efficiency</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
