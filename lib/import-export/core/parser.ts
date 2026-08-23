import type { ImportedRecord, ParserOptions } from './types';

export class StreamParser {
  /**
   * Parse a ReadableStream of Uint8Array into an array of ImportedRecord or stream them.
   * For v0.1 bounded streaming, we read the stream into text and parse rows.
   */
  async parseStream<T = Record<string, unknown>>(
    stream: ReadableStream<Uint8Array>,
    options: ParserOptions
  ): Promise<ImportedRecord<T>[]> {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let totalBytes = 0;
    let accumulatedText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (options.maxBytes && totalBytes > options.maxBytes) {
            throw new Error('IMPORT_SIZE_EXCEEDED: Maximum input bytes exceeded');
          }
          accumulatedText += decoder.decode(value, { stream: true });
        }
      }
      accumulatedText += decoder.decode();
    } finally {
      reader.releaseLock();
    }

    if (options.format === 'jsonl') {
      return this.parseJsonl<T>(accumulatedText, options);
    } else if (options.format === 'csv') {
      return this.parseCsv<T>(accumulatedText, options);
    } else {
      throw new Error(`FORMAT_UNSUPPORTED: Unsupported format ${options.format}`);
    }
  }

  private parseJsonl<T>(text: string, options: ParserOptions): ImportedRecord<T>[] {
    const lines = text.split(/\r?\n/);
    const records: ImportedRecord<T>[] = [];
    const skipRows = options.skipRows || 0;
    const maxRows = options.maxRows || Infinity;

    let rowIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      rowIndex++;
      if (rowIndex <= skipRows) continue;
      if (records.length >= maxRows) break;

      try {
        const value = JSON.parse(line) as T;
        records.push({
          row: rowIndex,
          value,
          valid: true,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        records.push({
          row: rowIndex,
          valid: false,
          errors: [
            {
              code: 'ROW_INVALID',
              message: `Failed to parse JSON line: ${message}`,
            },
          ],
        });
      }
    }

    return records;
  }

  private parseCsv<T>(text: string, options: ParserOptions): ImportedRecord<T>[] {
    const lines = text.split(/\r?\n/);
    const records: ImportedRecord<T>[] = [];
    const delimiter = options.delimiter || ',';
    const hasHeader = options.hasHeader !== false;
    const skipRows = options.skipRows || 0;
    const maxRows = options.maxRows || Infinity;

    let headers: string[] = [];
    let rowIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() && i === lines.length - 1) continue; // skip trailing empty line

      rowIndex++;
      if (rowIndex <= skipRows) continue;

      let parsedFields: string[];
      try {
        parsedFields = this.parseCsvLine(line, delimiter);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        records.push({
          row: rowIndex,
          valid: false,
          errors: [
            {
              code: 'CSV_MALFORMED_LINE',
              message,
            },
          ],
        });
        continue;
      }

      if (hasHeader && rowIndex === 1 + skipRows) {
        const seenHeaders = new Set<string>();
        for (const h of parsedFields) {
          const trimmed = h.trim();
          if (!trimmed) {
            throw new Error('CSV_EMPTY_HEADER: Empty column header detected.');
          }
          if (seenHeaders.has(trimmed.toLowerCase())) {
            throw new Error(`CSV_DUPLICATE_HEADER: Duplicate column header "${trimmed}" detected.`);
          }
          seenHeaders.add(trimmed.toLowerCase());
        }
        headers = parsedFields.map((h) => h.trim());
        continue;
      }

      if (records.length >= maxRows) {
        throw new Error(`IMPORT_ROW_LIMIT_EXCEEDED: CSV exceeds maximum limit of ${maxRows} rows.`);
      }

      try {
        if (hasHeader && headers.length > 0 && parsedFields.length !== headers.length) {
          records.push({
            row: rowIndex,
            valid: false,
            errors: [
              {
                code: 'ROW_COLUMN_COUNT_MISMATCH',
                message: `Row has ${parsedFields.length} columns, expected ${headers.length}.`,
              },
            ],
          });
          continue;
        }

        let value: T;
        if (hasHeader && headers.length > 0) {
          const obj: Record<string, unknown> = {};
          for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = parsedFields[j] !== undefined ? parsedFields[j] : '';
          }
          value = obj as T;
        } else {
          value = parsedFields as unknown as T;
        }

        records.push({
          row: rowIndex,
          value,
          valid: true,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        records.push({
          row: rowIndex,
          valid: false,
          errors: [
            {
              code: 'ROW_INVALID',
              message: `Failed to parse CSV row: ${message}`,
            },
          ],
        });
      }
    }

    return records;
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let quoteJustClosed = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes) {
          if (line[i + 1] === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = false;
            quoteJustClosed = true;
          }
        } else {
          if (currentField.length > 0 && !quoteJustClosed) {
            throw new Error('CSV_MALFORMED_QUOTE: Unexpected quote character inside unquoted field.');
          }
          inQuotes = true;
          quoteJustClosed = false;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(currentField);
        currentField = '';
        quoteJustClosed = false;
      } else {
        if (quoteJustClosed) {
          throw new Error('CSV_MALFORMED_QUOTE: Characters detected after closing quote before delimiter.');
        }
        currentField += char;
      }
    }

    if (inQuotes) {
      throw new Error('CSV_MALFORMED_QUOTE: Unclosed quote detected at end of line.');
    }

    fields.push(currentField);
    return fields.map((f) => f.trim());
  }
}
