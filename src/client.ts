import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let dbClient: DynamoDBClient;

export const connect = (region: string): DynamoDBDocumentClient => {
	if (!dbClient) {
		dbClient = DynamoDBDocumentClient.from(
			new DynamoDBClient({
				region: region,
			}),
			{
				marshallOptions: {
					removeUndefinedValues: true,
				},
			},
		);
	}

	return dbClient;
};
