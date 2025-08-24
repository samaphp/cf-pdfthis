# PDFthis

## Purpose
This service provides a simple placeholder PDF file that can be customized using URL
parameters.

## Use Cases
- Use as a temporary PDF for auto-generated datasets.
- Return a valid PDF where a PDF is required by a pipeline.
- Test integrations or demos that expect a PDF.
- Echo URL parameters as plain text (key = value).

## Step-by-step Example
`?title=Hello world!&text=This is a paragraph.&count=3`

[Click here to load the "Hello world!" example as a PDF.](https://pdfthis.timers.workers.dev/?title=Hello%20world!&text=This%20is%20a%20paragraph.&count=3)

## Notes
- Each value is limited to 500 characters.
- Up to 50 URL parameters are rendered (excluding title/text).
- Text is plain; no styling or formatting is applied.

## Disclaimer
The generated PDF file is for testing purposes. Content is rendered directly from URL parameters.
