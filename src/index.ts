import yargs from "yargs";
import Zotero from "zotero-lib";
import axios from "axios";

const argv = yargs(process.argv.slice(2))
  .command("items [items...]", "Process items")
  .option("group", {
    describe: "Group ID",
    type: "number",
  })
  .option("test", {
    describe: "Test mode",
    type: "boolean",
    default: false,
  })
  .demandCommand() // Require a command to be provided
  .help().argv; // Add a help command

// Call the main function after parsing
main(argv);

// Instead of this, it would be better to write some JQ and use the JQ function to do this.
// The jq string is quite similar, but basically closer to json than ts. I'm getting it's something like this:
/*
filter = "{
  volume: .volume;
  issue: .issue,
  pages: .page,
  journalAbbreviation: .['short-container-title'],
  publicationTitle: .['container-title'],
  url: .URL
}";

jq.run(filter,json_in, { input: 'json', output: 'json' }).then(console.log)

*/
const crossrefKeys = {
  volume: "volume",
  issue: "issue",
  pages: "page",
  journalAbbreviation: "short-container-title",
  publicationTitle: "container-title",
  url: "URL",
};


async function getCrossref(doi: string) {
  const url = `https://api.crossref.org/works/${doi}`;
  const res = await axios.get(url);
  return res.data;
}

async function extractKeyGroupVariable(key: any) {
  key = key.toString();
  const res = key.match(
    /^zotero\:\/\/select\/groups\/(library|\d+)\/(items|collections)\/([A-Z01-9]+)/
  );

  if (res) {
    if (res[2] === "library") {
      console.log(
        "You cannot specify zotero-select links (zotero://...) to select user libraries."
      );
      return [null, null];
    }

    return [res[1], res[3]];
  }

  if (!res) {
    // There wasn't a match. We might have a group, or a key.
    if (key.match(/^([A-Z01-9]+)/)) {
      // if the input like 2405685:JLEWADHF
      const match = key.match(/^(\d+):([A-Z01-9]+)/);
      if (match) {
        return [match[1], match[2]];
      }

      return [undefined, key];
    }
  }
  return [undefined, undefined];
}

async function main(argv: any) {
  // console.log(argv);

  const items = argv.items;
  if (!items) {
    console.log("No items specified");
    return;
  }
  for (const item of items) {
    // This needs to be improved. Input can be:
    // zotero://select/groups/2405685/items/JLEWADHF
    // 2405685:JLEWADHF
    // JLEWADHF --group 2405685
    // There's a function in zotero-lib that takes a key in those formats and returns a group / item pair - you uave to look up the actual name.
    const [group, id] = await extractKeyGroupVariable(item);
    // console.log(group, id);

    if (!group && !argv.group) {
      console.log(`No group specified so the item ${id} will not be processed`);
      continue;
    }
    const group_actual = argv.group ? argv.group : group;
    // console.log(group_actual);
    await process_item(group_actual, id, argv.test);
  }
}

function as_value(value: any) {
  if (Array.isArray(value)) {
    value = value[0];
  }
  return value;
}

async function process_item(group: string, id: string, test: boolean) {
  const zotero = new Zotero({ group_id: group, verbose: false });
  try {
    const item = await zotero.item({ key: [id] });
    if (item === undefined) {
      console.log(`Item ${id} not found`);
      return;
    }

    if (item.itemType !== "journalArticle") {
      console.log("Not a journal article");
      return;
    }
    const doi = await zotero.get_doi(item);
    if (doi === undefined) {
      console.log("DOI not found");
      return;
    }
    const crossref = await getCrossref(doi);

    //   fs.writeFileSync('crossref.json', JSON.stringify(crossref));
    //   fs.writeFileSync('item.json', JSON.stringify(item));

    let fields: any = {};
    for (const [sourceKey, targetKey] of Object.entries(crossrefKeys)) {
      const sourceValue = item[sourceKey];
      const targetValue = crossref.message[targetKey];

      if (!sourceValue && targetValue) {
        if (sourceKey === "journalAbbreviation") {
          fields[sourceKey] = as_value(targetValue);
        } else fields[sourceKey] = targetValue;
      }
    }

    if (Object.keys(fields).length === 0) {
      console.log(`Nothing to update for ${id}`);
      return;
    }
    console.log("what needs to be updated", fields);
    if (!test) {
      const update = await zotero.update_item({
        group: group,
        verbose: false,

        key: id,
        json: fields,
      });
      if (update.statusCode === 204) {
        console.log(`Item ${id} updated`);
      }
    }
  } catch (e) {
    // console.log(e);
    console.log(`Error processing item ${id}`);

    return;
  }
}
