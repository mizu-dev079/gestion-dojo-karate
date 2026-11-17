import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const limpiarTexto = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export class CrearClaseDto {
  @Transform(limpiarTexto)
  @IsString()
  @IsNotEmpty({ message: 'Completa este campo.' })
  @MaxLength(120)
  nivel: string;

  @Transform(limpiarTexto)
  @IsString()
  @IsNotEmpty({ message: 'Completa este campo.' })
  @MaxLength(120)
  sede: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Selecciona al menos un día de entrenamiento.' })
  @ArrayUnique({ message: 'No repitas días de entrenamiento.' })
  @IsIn(DIAS, { each: true, message: 'Selecciona días de entrenamiento válidos.' })
  @IsString({ each: true })
  frecuencia: string[];

  @Transform(limpiarTexto)
  @IsString()
  @IsNotEmpty({ message: 'Completa este campo.' })
  @MaxLength(120)
  profesor: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de inicio debe tener el formato HH:mm.',
  })
  horaInicio: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora de fin debe tener el formato HH:mm.' })
  horaFin: string;

  @IsNumber()
  @Min(0)
  tarifa: number = 0;

  @IsInt({ message: 'Los cupos deben ser un número entero.' })
  @Min(1, { message: 'El turno debe tener al menos un cupo.' })
  cupos: number;

  // Los turnos permanentes no tienen vigencia; el servicio exige estos campos para clases temporales.
  @ValidateIf((_objeto, valor) => valor !== undefined && valor !== '')
  @IsDateString()
  fechaInicio: string;

  @ValidateIf((_objeto, valor) => valor !== undefined && valor !== '')
  @IsString()
  @IsIn(['1 semana', '2 semanas', '3 semanas', '1 mes'])
  duracion: string;
}
