export interface IGetOptions {
  select?: string[];
  filter?: string;
  expand?: string[];
}

export interface IGetAllOptions extends IGetOptions {
  top?: number;
  orderBy?: string[];
  skip?: number;
  skipToken?: string;
  maxPageSize?: number;
}

export interface IOperationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}
