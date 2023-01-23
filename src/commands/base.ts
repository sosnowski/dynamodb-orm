import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DbClient } from 'src/client';
import type { Table } from '../table';

export abstract class Command<Input extends {}, Output, Res extends Result<Output>> {
	db: DbClient;
	table: Table;
	opts: Partial<Input>;
	constructor(db: DbClient, table: Table) {
		this.db = db;
		this.table = table;
		this.opts = {};
	}

	options(options: Partial<Input>): Command<Input, Output, Res> {
		Object.assign(this.opts, options);
		return this;
	}

	abstract send(): Promise<Res>;
	abstract input(): Input;
}

export abstract class Result<Output> {
	output: Output;
	table: Table;

	constructor(output: Output, table: Table) {
		this.output = output;
		this.table = table;
	}

	getOutput() {
		return this.output;
	}
}
