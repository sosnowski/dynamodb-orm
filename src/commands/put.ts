import { PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb';

import type { PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { EntityRecord } from '../entity';
import { unmarshallItem } from '../marshall';
import type { Table } from '../table';
import { Command, Result } from './base';
import { DbClient } from 'src/client';

export class PutItemCommand extends Command<PutCommandInput, PutCommandOutput, PutResult> {
	item: Record<string, any>;
	constructor(db: DbClient, table: Table, item: Record<string, string>) {
		super(db, table);
		this.item = item;
	}

	async send(): Promise<PutResult> {
		const output: PutCommandOutput = await this.db.send(new PutCommand(this.input()));
		return new PutResult(output, this.table);
	}

	input(): PutCommandInput {
		return {
			TableName: this.table.config().name,
			Item: this.item,
		}; // TODO: Merge with options
	}

	returnOld(): PutItemCommand {
		this.opts.ReturnValues = 'ALL_OLD';
		return this;
	}
	//TODO condition etc
}

export class PutResult extends Result<PutCommandOutput> {
	item<T extends object>(): (T & EntityRecord) | null {
		if (this.output.Attributes) {
			const entityType = this.output.Attributes._type;
			if (entityType && this.table.entity(entityType)) {
				const entity = this.table.entity<T>(entityType)!;
				return entity(unmarshallItem(this.output.Attributes) as T);
			} else {
				throw Error('Item does not have _type property or missing entity with such type :' + entityType);
			}
		}
		return null;
	}

	raw(): Record<string, any> | undefined {
		return this.output.Attributes;
	}
}
