import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';

import type { QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { EntityRecord } from '../entity';
import { unmarshallItem } from '../marshall';
import type { Table } from '../table';
import { Command, Result } from './base';
import { DbClient } from 'src/client';

export class QueryItemsCommand extends Command<QueryCommandInput, QueryCommandOutput, QueryResult> {
	condition: string;
	values: Record<string, any>;
	constructor(db: DbClient, table: Table, condition: string, values: Record<string, any>) {
		super(db, table);
		this.condition = condition;
		this.values = values;
	}

	input(): QueryCommandInput {
		const attributesNames = Object.fromEntries(Object.keys(this.values).map((key) => [`#${key}`, key]));
		const attributesValues = Object.fromEntries(Object.entries(this.values).map(([key, value]) => [`:${key}`, value]));

		return {
			TableName: this.table.config().name,
			KeyConditionExpression: this.condition,
			ExpressionAttributeNames: attributesNames,
			ExpressionAttributeValues: attributesValues,
		};
	}

	async send(): Promise<QueryResult> {
		const output: QueryCommandOutput = await this.db.send(new QueryCommand(this.input()));
		return new QueryResult(output, this.table);
	}

	index(indexName: string): QueryItemsCommand {
		if (!Object.keys(this.table.config().indexes || []).includes(indexName)) {
			throw new Error(`Index ${indexName} is not defined on the table`);
		}
		this.opts.IndexName = indexName;
		return this;
	}
	//TODO filters, pagination etc.
}

export class QueryResult extends Result<QueryCommandOutput> {
	items<T extends object>(): (T & EntityRecord)[] {
		if (this.output.Items) {
			return this.output.Items.map((item) => {
				if (item._type && this.table.entity(item._type)) {
					const entity = this.table.entity<T>(item._type)!;
					return entity(unmarshallItem(item) as T);
				} else {
					throw Error('Item does not have _type property or missing entity with such type :' + item._type);
				}
			});
		}
		return [];
	}

	raw(): Record<string, any>[] | undefined {
		return this.output.Items;
	}
}
