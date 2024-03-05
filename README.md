# Zotero Record Complete from DOI

This script is designed to update items in Zotero with metadata retrieved from the CrossRef API.

## Installation

1. Clone this repository `git clone https://github.com/OpenDevEd/zotero-record-complete-from-doi.git`
2. Install dependencies by running `npm install`.

## Usage

To use this script, follow these steps:

1. Make sure you have Node.js installed on your system.
2. Run the script with the desired parameters.

### Command Line Options

- `items`: A list of item keys in Zotero to process.
- `group`: (Optional) The ID of the group to which the items belong. If not provided, the items should be like `zotero://select/groups/2400000/items/XXXXXXX` or `2400000:XXXXXXX`
- `test`: (Optional) Set to `true` to run the script in test mode (no updates will be made).

### Examples

1. Update items by providing Zotero item keys:

   ```bash
   npm run items  --  XXXXXXXX YYYYYYY
   ```

2. Update items specifying the group:

   ```bash
   npm run items  --  XXXXXXXX --group 2400000
   ```

3. Run in test mode:
   ```bash
   npm run items  --  XXXXXXXX --test
   ```
