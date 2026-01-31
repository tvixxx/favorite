import { ApiProperty } from '@nestjs/swagger';

export class AuthResponse {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyodDJslqkcqKd5kR2qomsoadjpoasaMsjs...',
  })
  accessToken: string;
}
