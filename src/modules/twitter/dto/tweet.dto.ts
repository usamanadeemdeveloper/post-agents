import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class TweetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  content: string;
}
