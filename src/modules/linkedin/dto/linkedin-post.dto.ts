import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class LinkedInPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  content: string;
}
