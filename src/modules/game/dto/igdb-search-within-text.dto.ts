import { IsNotEmpty, IsString } from 'class-validator';

export class IgdbSearchWithinTextDto {
  @IsNotEmpty()
  @IsString()
  text!: string;
}
