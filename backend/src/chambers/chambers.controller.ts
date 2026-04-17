import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ChambersService } from './chambers.service';
import { CreateChamberDto } from './dto/create-chamber.dto';

@Controller('chambers')
export class ChambersController {
  constructor(private readonly chambersService: ChambersService) {}

  @Get()
  findAll() {
    return this.chambersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.chambersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateChamberDto) {
    return this.chambersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateChamberDto>,
  ) {
    return this.chambersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chambersService.remove(id);
  }
}
