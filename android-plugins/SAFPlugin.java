package app.lovable.e61fee5bc92f456f8684aa0b1a8db0a3.plugins;

import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "SAFFolderPicker")
public class SAFPlugin extends Plugin {

    private static final int REQUEST_CODE = 4242;
    private PluginCall savedCall;

    // =========================
    // Folder Picker
    // =========================
    @PluginMethod
    public void pickFolder(PluginCall call) {
        this.savedCall = call;

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);

        startActivityForResult(call, intent, REQUEST_CODE);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_CODE && data != null && savedCall != null) {
            Uri treeUri = data.getData();

            try {
                getContext().getContentResolver().takePersistableUriPermission(
                        treeUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                );

                JSObject ret = new JSObject();
                ret.put("folderUri", treeUri.toString());
                savedCall.resolve(ret);

            } catch (Exception e) {
                savedCall.reject("SAF permission error: " + e.getMessage());
            }
        }
    }

    // =========================
    // Rename Files
    // =========================
    @PluginMethod
    public void renameFiles(PluginCall call) {
        try {
            String folderUriStr = call.getString("folderUri");
            List<JSObject> files = call.getArray("files").toList();

            Uri folderUri = Uri.parse(folderUriStr);
            Context context = getContext();

            DocumentFile folder = DocumentFile.fromTreeUri(context, folderUri);
            if (folder == null || !folder.isDirectory()) {
                call.reject("Invalid folder URI");
                return;
            }

            for (JSObject fileObj : files) {
                String oldName = fileObj.getString("oldName");
                String newName = fileObj.getString("newName");

                DocumentFile target = findFile(folder, oldName);
                if (target != null && target.exists()) {
                    boolean ok = target.renameTo(newName);

                    if (ok) {
                        // MediaStore refresh
                        MediaScannerConnection.scanFile(
                                context,
                                new String[]{ target.getUri().toString() },
                                null,
                                null
                        );
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);

        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    // =========================
    // Utils
    // =========================
    private DocumentFile findFile(DocumentFile dir, String name) {
        for (DocumentFile file : dir.listFiles()) {
            if (file.isFile() && name.equals(file.getName())) {
                return file;
            }
        }
        return null;
    }
}