import { IsOptional, IsEnum } from "class-validator";

/**
 * Education Stage Codes
 */
export enum EducationStageCode {
  BERCARIO = "BERCARIO",
  INFANTIL = "INFANTIL",
  FUNDAMENTAL_I = "FUNDAMENTAL_I",
  FUNDAMENTAL_II = "FUNDAMENTAL_II",
  MEDIO = "MEDIO",
}

/**
 * DTO para query de dashboard
 * GET /plannings/dashboard?stage=INFANTIL
 */
export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(EducationStageCode, {
    message: "Stage deve ser um código de etapa válido",
  })
  stage?: EducationStageCode;

  @IsOptional()
  @IsEnum(EducationStageCode, {
    message: "Segment deve ser um código de etapa válido",
  })
  segment?: EducationStageCode;
}
