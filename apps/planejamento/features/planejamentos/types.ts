export type QuinzenaStatus = "locked" | "unlocked" | "completed";
export type DeadlineStatus = "normal" | "warning" | "urgent" | "late";

export interface Quinzena {
  id: string;
  number: number;
  startDate: Date;
  endDate: Date;
  deadline: Date;
  status: QuinzenaStatus;
  deadlineStatus: DeadlineStatus;
  userParams?: {
    isCompleted?: boolean; // Mock param to simulate if the teacher finished previous one
  };
}

export interface LessonPlan {
  id: string;
  quinzenaId: string;
  turma: string;
  materia: string;
  tema: string;
  objetivos: string;
  createdAt: Date;
  updatedAt: Date;
}
